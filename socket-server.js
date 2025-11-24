const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  // Health check endpoint for Elastic Beanstalk
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins in production (or specify your Amplify URL)
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// In-memory storage for lobbies
const lobbies = new Map();

// Helper to generate random lobby code
function generateLobbyCode(length = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create_lobby', ({ name }, callback) => {
    const code = generateLobbyCode();
    const lobby = {
      code,
      host: socket.id,
      users: [{ id: socket.id, name: name || 'Host' }],
      settings: { pointsLimit: 100, teamSizeLimit: 10, genFilter: 0 },
      pointsMap: {},
      selections: {},
      pointsRemaining: { [socket.id]: 100 },
      draftStarted: false,
      currentTurn: null,
      draftOrder: []
    };
    lobbies.set(code, lobby);
    socket.join(code);
    socket.lobbyCode = code;
    
    console.log(`Lobby created: ${code} by ${name}`);
    
    callback({
      ok: true,
      code,
      host: socket.id,
      users: lobby.users,
      settings: lobby.settings,
      pointsMap: lobby.pointsMap,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining
    });
  });

  socket.on('join_lobby', ({ code, name, savedPoints, savedSelections }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) {
      return callback({ ok: false, error: 'Lobby not found' });
    }
    
    if (lobby.users.length >= 12) {
      return callback({ ok: false, error: 'Lobby is full' });
    }
    
    const user = { id: socket.id, name: name || `Player-${lobby.users.length + 1}` };
    lobby.users.push(user);
    
    // Use saved points if provided, otherwise default to points limit
    lobby.pointsRemaining[socket.id] = savedPoints != null ? savedPoints : lobby.settings.pointsLimit;
    
    // Restore saved selections if provided
    if (savedSelections && Array.isArray(savedSelections) && savedSelections.length > 0) {
      lobby.selections[socket.id] = savedSelections;
      console.log(`Restored ${savedSelections.length} selections for ${name}`);
    }
    
    socket.join(code);
    socket.lobbyCode = code;
    
    console.log(`${name} joined lobby: ${code} with ${lobby.pointsRemaining[socket.id]} points`);
    
    callback({
      ok: true,
      code,
      host: lobby.host,
      users: lobby.users,
      settings: lobby.settings,
      pointsMap: lobby.pointsMap,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      draftOrder: lobby.draftOrder,
      currentTurn: lobby.currentTurn
    });
    
    io.to(code).emit('lobby_update', {
      code,
      host: lobby.host,
      users: lobby.users,
      settings: lobby.settings,
      pointsMap: lobby.pointsMap,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      draftOrder: lobby.draftOrder,
      currentTurn: lobby.currentTurn,
      draftStarted: lobby.draftStarted
    });
  });

  socket.on('leave_lobby', ({ code }) => {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    lobby.users = lobby.users.filter(u => u.id !== socket.id);
    delete lobby.selections[socket.id];
    delete lobby.pointsRemaining[socket.id];
    
    socket.leave(code);
    delete socket.lobbyCode;
    
    if (lobby.users.length === 0) {
      lobbies.delete(code);
      console.log(`Lobby ${code} deleted (empty)`);
    } else {
      if (lobby.host === socket.id) {
        lobby.host = lobby.users[0].id;
      }
      io.to(code).emit('lobby_update', {
        code,
        host: lobby.host,
        users: lobby.users,
        settings: lobby.settings,
        pointsMap: lobby.pointsMap,
        selections: lobby.selections,
        pointsRemaining: lobby.pointsRemaining,
        draftOrder: lobby.draftOrder,
        currentTurn: lobby.currentTurn
      });
    }
  });

  socket.on('update_settings', ({ code, settings }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) return callback({ ok: false, error: 'Lobby not found' });
    if (lobby.host !== socket.id) return callback({ ok: false, error: 'Only host can update settings' });
    
    lobby.settings = { ...lobby.settings, ...settings };
    
    // Update points remaining if limit changed
    if (settings.pointsLimit != null) {
      for (const userId in lobby.pointsRemaining) {
        lobby.pointsRemaining[userId] = settings.pointsLimit;
      }
    }
    
    callback({ ok: true });
    io.to(code).emit('lobby_update', {
      code,
      host: lobby.host,
      users: lobby.users,
      settings: lobby.settings,
      pointsMap: lobby.pointsMap,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      currentTurn: lobby.currentTurn
    });
  });

  socket.on('set_points', ({ code, name, value }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) return callback({ ok: false, error: 'Lobby not found' });
    if (lobby.host !== socket.id) return callback({ ok: false, error: 'Only host can set points' });
    
    const normalizedName = name.toLowerCase();
    lobby.pointsMap[normalizedName] = Number(value);
    
    console.log(`Points set for ${normalizedName}: ${value}`);
    
    callback({ ok: true, pointsMap: lobby.pointsMap });
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
  });

  socket.on('import_points', ({ code, pointsMap }, callback) => {
    console.log(`import_points request: code=${code}, host=${socket.id}`);
    const lobby = lobbies.get(code);
    if (!lobby) {
      console.log('import_points error: Lobby not found');
      return callback({ ok: false, error: 'Lobby not found' });
    }
    if (lobby.host !== socket.id) {
      console.log(`import_points error: Not host. socket=${socket.id}, host=${lobby.host}`);
      return callback({ ok: false, error: 'Only host can import points' });
    }
    
    const normalized = {};
    for (const [k, v] of Object.entries(pointsMap)) {
      normalized[k.toLowerCase()] = Number(v);
    }
    
    lobby.pointsMap = { ...lobby.pointsMap, ...normalized };
    console.log(`import_points success: imported ${Object.keys(normalized).length} entries`);
    
    callback({ ok: true, pointsMap: lobby.pointsMap });
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
  });

  socket.on('start_draft', ({ code }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) return callback({ ok: false, error: 'Lobby not found' });
    if (lobby.host !== socket.id) return socket.emit('start_rejected', { reason: 'not_host' });
    
    lobby.draftStarted = true;
    // Randomize draft order using Fisher-Yates shuffle
    const userIds = lobby.users.map(u => u.id);
    for (let i = userIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [userIds[i], userIds[j]] = [userIds[j], userIds[i]];
    }
    lobby.draftOrder = userIds;
    lobby.currentTurn = lobby.draftOrder[0];
    
    callback({ ok: true });
    io.to(code).emit('draft_started', {
      code,
      pointsMap: lobby.pointsMap,
      draftOrder: lobby.draftOrder
    });
    io.to(code).emit('lobby_update', {
      code,
      host: lobby.host,
      users: lobby.users,
      settings: lobby.settings,
      pointsMap: lobby.pointsMap,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      draftOrder: lobby.draftOrder,
      currentTurn: lobby.currentTurn,
      draftStarted: true
    });
  });

  socket.on('select_pokemon', ({ code, name, pokemon }) => {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    if (lobby.currentTurn !== socket.id) {
      return socket.emit('select_rejected', { pokemon, reason: 'not_your_turn' });
    }
    
    const cost = lobby.pointsMap[pokemon.name] != null ? lobby.pointsMap[pokemon.name] : 1;
    const remaining = lobby.pointsRemaining[socket.id] || 0;
    
    if (remaining < cost) {
      return socket.emit('select_rejected', { pokemon, reason: 'insufficient_points' });
    }
    
    // Check if already selected
    for (const selections of Object.values(lobby.selections)) {
      if (Array.isArray(selections) && selections.some(p => p.id === pokemon.id)) {
        return socket.emit('select_rejected', { pokemon, reason: 'already_selected' });
      }
    }
    
    if (!lobby.selections[socket.id]) {
      lobby.selections[socket.id] = [];
    }
    lobby.selections[socket.id].push(pokemon);
    lobby.pointsRemaining[socket.id] = remaining - cost;
    
    // Move to next turn - skip disconnected players
    const currentIndex = lobby.draftOrder.indexOf(lobby.currentTurn);
    let nextIndex = (currentIndex + 1) % lobby.draftOrder.length;
    let attempts = 0;
    const maxAttempts = lobby.draftOrder.length;
    
    // Find next active player (one who is still in the lobby)
    while (attempts < maxAttempts) {
      const nextPlayerId = lobby.draftOrder[nextIndex];
      const playerExists = lobby.users.some(u => u.id === nextPlayerId);
      if (playerExists) {
        lobby.currentTurn = nextPlayerId;
        break;
      }
      nextIndex = (nextIndex + 1) % lobby.draftOrder.length;
      attempts++;
    }
    
    console.log(`Turn moved from index ${currentIndex} to ${nextIndex}, currentTurn: ${lobby.currentTurn}`);
    
    // Check if draft is complete (all players have reached team size limit)
    const teamSizeLimit = lobby.settings.teamSizeLimit || 10;
    const allPlayersComplete = lobby.users.every(user => {
      const userSelections = lobby.selections[user.id] || [];
      return userSelections.length >= teamSizeLimit;
    });
    
    if (allPlayersComplete) {
      console.log(`Draft complete for lobby ${code}`);
      io.to(code).emit('draft_complete', {
        selections: lobby.selections,
        users: lobby.users
      });
    }
    
    io.to(code).emit('user_selected', {
      userId: socket.id,
      name,
      pokemon
    });
    io.to(code).emit('selections_update', { selections: lobby.selections });
    io.to(code).emit('points_update', { pointsRemaining: lobby.pointsRemaining });
    io.to(code).emit('turn_update', { currentTurn: lobby.currentTurn });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.lobbyCode) {
      const lobby = lobbies.get(socket.lobbyCode);
      if (lobby) {
        lobby.users = lobby.users.filter(u => u.id !== socket.id);
        
        if (lobby.users.length === 0) {
          lobbies.delete(socket.lobbyCode);
          console.log(`Lobby ${socket.lobbyCode} deleted (empty after disconnect)`);
        } else {
          if (lobby.host === socket.id) {
            lobby.host = lobby.users[0].id;
          }
          io.to(socket.lobbyCode).emit('lobby_update', {
            code: socket.lobbyCode,
            host: lobby.host,
            users: lobby.users,
            settings: lobby.settings,
            pointsMap: lobby.pointsMap,
            selections: lobby.selections,
            pointsRemaining: lobby.pointsRemaining,
            draftOrder: lobby.draftOrder,
            currentTurn: lobby.currentTurn
          });
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Socket.IO server listening on http://localhost:${PORT}`);
});
