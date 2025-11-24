const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET','POST']
  }
});

const PORT = process.env.PORT || 4000;

// In-memory lobby store. Lobby structure:
// {
//   users: [{id, name}],
//   draftStarted: bool,
//   selections: { [userName]: [pokemonObjs] },
//   host: socket.id,
//   settings: { pointsLimit: 100, bansPerPlayer: 0 },
//   banList: [{ name, addedBy }],
//   pointsMap: { [pokemonName]: points },
//   pointsRemaining: { [socketId]: number },
//   picksMade: number,
// }
const lobbies = {};

function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getCurrentTurnSocketId(lobby) {
  if (!lobby || !lobby.draftOrder || lobby.draftOrder.length === 0) return null;
  const numPlayers = lobby.draftOrder.length;
  const picks = lobby.picksMade || 0;
  const round = Math.floor(picks / numPlayers);
  const pos = picks % numPlayers;
  if (round % 2 === 0) {
    return lobby.draftOrder[pos];
  } else {
    return lobby.draftOrder[numPlayers - 1 - pos];
  }
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('create_lobby', (payload, ack) => {
    const name = payload && payload.name ? payload.name : `Player-${Math.floor(Math.random()*1000)}`;
    let code;
    do { code = generateCode(); } while (lobbies[code]);
    lobbies[code] = {
      users: [{ id: socket.id, name }],
      draftStarted: false,
      selections: {},
      host: socket.id,
      settings: { pointsLimit: 100 },
      banList: [],
      pointsMap: {},
      pointsRemaining: { [socket.id]: 100 },
      picksMade: 0
    };
    socket.join(code);
    console.log(`Lobby ${code} created by ${name}`);
    if (ack) ack({ ok: true, code, users: lobbies[code].users, selections: lobbies[code].selections, host: lobbies[code].host, settings: lobbies[code].settings, banList: lobbies[code].banList.map(b => b.name), pointsMap: lobbies[code].pointsMap, pointsRemaining: lobbies[code].pointsRemaining, draftStarted: lobbies[code].draftStarted, currentTurn: getCurrentTurnSocketId(lobbies[code]), draftOrder: lobbies[code].draftOrder });
    io.to(code).emit('lobby_update', { code, users: lobbies[code].users, selections: lobbies[code].selections, host: lobbies[code].host, settings: lobbies[code].settings, banList: lobbies[code].banList.map(b => b.name), pointsMap: lobbies[code].pointsMap, pointsRemaining: lobbies[code].pointsRemaining, draftStarted: lobbies[code].draftStarted, currentTurn: getCurrentTurnSocketId(lobbies[code]), draftOrder: lobbies[code].draftOrder });
  });

  socket.on('join_lobby', (payload, ack) => {
    const { code, name } = payload || {};
    if (!code || !lobbies[code]) {
      if (ack) ack({ ok: false, error: 'Lobby not found' });
      return;
    }
    if (lobbies[code].users.length >= 12) {
      if (ack) ack({ ok: false, error: 'Lobby full' });
      return;
    }
    lobbies[code].users.push({ id: socket.id, name });
    // initialize pointsRemaining for new user
    lobbies[code].pointsRemaining[socket.id] = lobbies[code].settings.pointsLimit;
    socket.join(code);
    console.log(`${name} joined lobby ${code}`);
    if (ack) ack({ ok: true, code, users: lobbies[code].users, selections: lobbies[code].selections, host: lobbies[code].host, settings: lobbies[code].settings, banList: lobbies[code].banList.map(b => b.name), pointsMap: lobbies[code].pointsMap, pointsRemaining: lobbies[code].pointsRemaining, draftStarted: lobbies[code].draftStarted, currentTurn: getCurrentTurnSocketId(lobbies[code]), draftOrder: lobbies[code].draftOrder });
    io.to(code).emit('lobby_update', { code, users: lobbies[code].users, selections: lobbies[code].selections, host: lobbies[code].host, settings: lobbies[code].settings, banList: lobbies[code].banList.map(b => b.name), pointsMap: lobbies[code].pointsMap, pointsRemaining: lobbies[code].pointsRemaining, draftStarted: lobbies[code].draftStarted, currentTurn: getCurrentTurnSocketId(lobbies[code]), draftOrder: lobbies[code].draftOrder });
  });

  socket.on('leave_lobby', (payload, ack) => {
    const { code, name } = payload || {};
    if (!code || !lobbies[code]) {
      if (ack) ack({ ok: false });
      return;
    }
    // remove user and their selections
    const user = lobbies[code].users.find(u => u.id === socket.id);
    if (user && lobbies[code].selections[user.name]) delete lobbies[code].selections[user.name];
    // remove bans added by this user
    lobbies[code].banList = lobbies[code].banList.filter(b => b.addedBy !== socket.id);
    delete lobbies[code].pointsRemaining[socket.id];
    lobbies[code].users = lobbies[code].users.filter(u => u.id !== socket.id);
    // if host left, promote next user (if any)
    if (lobbies[code].host === socket.id) {
      lobbies[code].host = lobbies[code].users.length > 0 ? lobbies[code].users[0].id : null;
    }
    socket.leave(code);
    io.to(code).emit('lobby_update', { code, users: lobbies[code].users, selections: lobbies[code].selections, host: lobbies[code].host, settings: lobbies[code].settings, banList: lobbies[code].banList.map(b => b.name), pointsMap: lobbies[code].pointsMap, pointsRemaining: lobbies[code].pointsRemaining, draftStarted: lobbies[code].draftStarted, currentTurn: getCurrentTurnSocketId(lobbies[code]), draftOrder: lobbies[code].draftOrder });
    if (ack) ack({ ok: true });
    // if lobby empty, delete it
    if (lobbies[code].users.length === 0) delete lobbies[code];
  });

  socket.on('start_draft', (payload, ack) => {
    const { code } = payload || {};
    if (!code || !lobbies[code]) {
      if (ack) ack({ ok: false, error: 'Lobby not found' });
      return;
    }
    // Only the host may start the draft
    if (lobbies[code].host !== socket.id) {
      if (ack) ack({ ok: false, error: 'Only the lobby host can start the draft' });
      socket.emit('start_rejected', { reason: 'not_host' });
      return;
    }
    // initialize picks and order
    lobbies[code].draftStarted = true;
    lobbies[code].picksMade = 0;
    // capture current order of users
    lobbies[code].draftOrder = lobbies[code].users.map(u => u.id);
    // ensure pointsRemaining exists for all users
    for (const u of lobbies[code].users) {
      if (!lobbies[code].pointsRemaining[u.id]) lobbies[code].pointsRemaining[u.id] = lobbies[code].settings.pointsLimit;
    }
    // broadcast full lobby state including banList, pointsMap and draft order
    io.to(code).emit('draft_started', { code, banList: lobbies[code].banList.map(b => b.name), pointsMap: lobbies[code].pointsMap, draftOrder: lobbies[code].draftOrder });
    // send initial points and turn
    io.to(code).emit('points_update', { pointsRemaining: lobbies[code].pointsRemaining });
    const currentTurn = getCurrentTurnSocketId(lobbies[code]);
    io.to(code).emit('turn_update', { currentTurn });
    if (ack) ack({ ok: true });
  });

  // enforce unique picks, bans, points, and turn order
  socket.on('select_pokemon', (payload, ack) => {
    const { code, name, pokemon } = payload || {};
    if (!code || !lobbies[code]) {
      if (ack) ack({ ok: false, error: 'Lobby not found' });
      return;
    }
    const lobby = lobbies[code];
    if (!lobby.draftStarted) {
      if (ack) ack({ ok: false, error: 'Draft not started' });
      return;
    }
    // check turn
    const currentTurnId = getCurrentTurnSocketId(lobby);
    if (socket.id !== currentTurnId) {
      if (ack) ack({ ok: false, error: 'Not your turn' });
      socket.emit('select_rejected', { pokemon, reason: 'not_your_turn' });
      return;
    }
    // check bans
    if (lobby.banList.some(b => b.name === pokemon.name)) {
      if (ack) ack({ ok: false, error: 'Pokemon is banned' });
      socket.emit('select_rejected', { pokemon, reason: 'banned' });
      return;
    }
    // check if pokemon already selected (by id or name)
    const already = Object.values(lobby.selections).some(arr => arr.some(p => (p.id && pokemon.id && p.id === pokemon.id) || (p.name && pokemon.name && p.name === pokemon.name)));
    if (already) {
      if (ack) ack({ ok: false, error: 'Pokemon already selected' });
      socket.emit('select_rejected', { pokemon, reason: 'already_selected' });
      return;
    }
    // determine cost
    const cost = lobby.pointsMap[pokemon.name] || 1;
    const remaining = lobby.pointsRemaining[socket.id] || 0;
    if (remaining < cost) {
      if (ack) ack({ ok: false, error: 'Insufficient points' });
      socket.emit('select_rejected', { pokemon, reason: 'insufficient_points' });
      return;
    }
    // accept pick
    lobby.selections[name] = lobby.selections[name] || [];
    lobby.selections[name].push(pokemon);
    // deduct points
    lobby.pointsRemaining[socket.id] = remaining - cost;
    // increment picksMade
    lobby.picksMade = (lobby.picksMade || 0) + 1;
    // broadcasts
    io.to(code).emit('user_selected', { name, pokemon });
    io.to(code).emit('selections_update', { selections: lobby.selections });
    io.to(code).emit('points_update', { pointsRemaining: lobby.pointsRemaining });
    const nextTurn = getCurrentTurnSocketId(lobby);
    io.to(code).emit('turn_update', { currentTurn: nextTurn });
    if (ack) ack({ ok: true });
  });

  // add ban (each user limited by settings.bansPerPlayer)
  socket.on('add_ban', (payload, ack) => {
    const { code, name } = payload || {};
    if (!code || !lobbies[code]) return ack && ack({ ok: false, error: 'Lobby not found' });
    const lobby = lobbies[code];
    if (lobby.draftStarted) return ack && ack({ ok: false, error: 'Draft already started' });
    // Only the host may add bans now
    if (lobby.host !== socket.id) return ack && ack({ ok: false, error: 'Only the lobby host may set bans' });
    if (lobby.banList.some(b => b.name === name)) return ack && ack({ ok: false, error: 'Already banned' });
    lobby.banList.push({ name, addedBy: socket.id });
    // mark as banned by setting points to 0
    lobby.pointsMap[name] = 0;
    io.to(code).emit('banlist_update', { banList: lobby.banList.map(b => b.name) });
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
    if (ack) ack({ ok: true });
  });

  socket.on('remove_ban', (payload, ack) => {
    const { code, name } = payload || {};
    if (!code || !lobbies[code]) return ack && ack({ ok: false, error: 'Lobby not found' });
    const lobby = lobbies[code];
    const ban = lobby.banList.find(b => b.name === name);
    if (!ban) return ack && ack({ ok: false, error: 'Ban not found' });
    // only the host may remove bans
    if (lobby.host !== socket.id) return ack && ack({ ok: false, error: 'Only the lobby host may remove bans' });
    lobby.banList = lobby.banList.filter(b => b.name !== name);
    // if the pokemon was marked 0 by ban, restore to 1
    if (lobby.pointsMap[name] === 0) lobby.pointsMap[name] = 1;
    io.to(code).emit('banlist_update', { banList: lobby.banList.map(b => b.name) });
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
    if (ack) ack({ ok: true });
  });

  // host-only: set points for a pokemon
  socket.on('set_points', (payload, ack) => {
    const { code, name, value } = payload || {};
    if (!code || !lobbies[code]) return ack && ack({ ok: false, error: 'Lobby not found' });
    const lobby = lobbies[code];
    if (lobby.host !== socket.id) return ack && ack({ ok: false, error: 'Only host can set points' });
    // Accept explicit 0 (banned). For other numeric values, clamp to 1..20.
    const raw = Number(value);
    let v;
    if (!Number.isFinite(raw)) {
      v = 1;
    } else if (raw === 0 || raw === "banned") {
      v = 0;
    } else {
      v = Math.max(1, Math.min(20, raw));
    }
    lobby.pointsMap[name] = v;
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
    if (ack) ack({ ok: true, pointsMap: lobby.pointsMap });
  });

  // host-only: import bulk points map (payload.pointsMap = {name: value, ...})
  socket.on('import_points', (payload, ack) => {
    const { code, pointsMap } = payload || {};
    if (!code || !lobbies[code]) return ack && ack({ ok: false, error: 'Lobby not found' });
    const lobby = lobbies[code];
    if (lobby.host !== socket.id) return ack && ack({ ok: false, error: 'Only host can import points' });
    if (lobby.draftStarted) return ack && ack({ ok: false, error: 'Draft already started' });
    if (!pointsMap || typeof pointsMap !== 'object') return ack && ack({ ok: false, error: 'Invalid points map' });
    for (const [k, v] of Object.entries(pointsMap)) {
      const raw = Number(v);
      let val;
      if (!Number.isFinite(raw)) {
        val = 1;
      } else if (raw === 0) {
        val = 0;
      } else {
        val = Math.max(1, Math.min(20, raw));
      }
      lobby.pointsMap[k] = val;
    }
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
    if (ack) ack({ ok: true, pointsMap: lobby.pointsMap });
  });

  // host-only: update lobby settings
  socket.on('update_settings', (payload, ack) => {
    const { code, settings } = payload || {};
    if (!code || !lobbies[code]) return ack && ack({ ok: false, error: 'Lobby not found' });
    const lobby = lobbies[code];
    if (lobby.host !== socket.id) return ack && ack({ ok: false, error: 'Only host can change settings' });
    if (settings.pointsLimit != null) {
      lobby.settings.pointsLimit = Number(settings.pointsLimit) || lobby.settings.pointsLimit;
      // reset pointsRemaining for everyone to new limit
      for (const u of lobby.users) lobby.pointsRemaining[u.id] = lobby.settings.pointsLimit;
    }
    if (settings.genFilter != null) {
      lobby.settings.genFilter = Number(settings.genFilter) || 0;
    }
    // bansPerPlayer setting removed; bans are host-controlled now
    io.to(code).emit('lobby_update', { code, users: lobby.users, selections: lobby.selections, host: lobby.host, settings: lobby.settings, banList: lobby.banList.map(b => b.name), pointsMap: lobby.pointsMap, pointsRemaining: lobby.pointsRemaining, draftStarted: lobby.draftStarted, currentTurn: getCurrentTurnSocketId(lobby), draftOrder: lobby.draftOrder });
    if (ack) ack({ ok: true, settings: lobby.settings });
  });

  socket.on('disconnecting', () => {
    // remove from any lobbies
    const rooms = Object.keys(socket.rooms).filter(r => r !== socket.id);
    for (const code of rooms) {
      if (lobbies[code]) {
        const user = lobbies[code].users.find(u => u.id === socket.id);
        if (user && lobbies[code].selections[user.name]) delete lobbies[code].selections[user.name];
        // remove bans added by this user
        lobbies[code].banList = lobbies[code].banList.filter(b => b.addedBy !== socket.id);
        // remove pointsRemaining for this user
        delete lobbies[code].pointsRemaining[socket.id];
        lobbies[code].users = lobbies[code].users.filter(u => u.id !== socket.id);
        // if host left, promote next user (if any)
        if (lobbies[code].host === socket.id) {
          lobbies[code].host = lobbies[code].users.length > 0 ? lobbies[code].users[0].id : null;
        }
        io.to(code).emit('lobby_update', { code, users: lobbies[code].users, selections: lobbies[code].selections, host: lobbies[code].host, settings: lobbies[code].settings, banList: lobbies[code].banList.map(b => b.name), pointsMap: lobbies[code].pointsMap, pointsRemaining: lobbies[code].pointsRemaining, draftStarted: lobbies[code].draftStarted, currentTurn: getCurrentTurnSocketId(lobbies[code]), draftOrder: lobbies[code].draftOrder });
        if (lobbies[code].users.length === 0) delete lobbies[code];
      }
    }
    console.log('socket disconnecting', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Socket.IO server running');
});

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
