require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const leagueRoutes = require('./league-routes');
const savedTeamRoutes = require('./saved-team-routes');
const { router: authRoutes } = require('./auth-routes');
const draftRoutes = require('./draft-routes');
const { DraftSession } = require('./models');

const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
.then(() => {
  // Start cleanup job
  startCleanupJob();
})
.catch(err => console.error('MongoDB connection error:', err));

// Cleanup job to delete empty drafts
function startCleanupJob() {
  // Run immediately on startup
  cleanupEmptyDrafts();
  
  // Run daily (every 24 hours)
  setInterval(cleanupEmptyDrafts, 24 * 60 * 60 * 1000);
}

async function cleanupEmptyDrafts() {
  try {
    const result = await DraftSession.deleteMany({
      $or: [
        { participants: { $size: 0 } },
        { participants: { $exists: false } },
        { participants: null }
      ]
    });
    
    if (result.deletedCount > 0) {
    }
  } catch (error) {
    console.error('Cleanup job error:', error);
  }
}

// Load presets from file
let presets = [];
try {
  const presetsPath = path.join(__dirname, 'public', 'presets.json');
  const presetsData = JSON.parse(fs.readFileSync(presetsPath, 'utf-8'));
  presets = presetsData.presets || [];
} catch (err) {
  console.error('Failed to load presets.json:', err);
}

// Create Express app for REST API
const app = express();
app.use(cors({
  origin: ['https://pokemondraft.com', 'https://www.pokemondraft.com', 'http://localhost:3000', 'http://localhost:4001'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/', (req, res) => res.send('OK'));
app.get('/health', (req, res) => res.send('OK'));

// Auth API routes
app.use('/api/auth', authRoutes);

// League API routes
app.use('/api', leagueRoutes);

// Saved Team API routes
app.use('/api', savedTeamRoutes);

// Draft session API routes
app.use('/api', draftRoutes);

// Create HTTP server from Express app
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'https://pokemondraft.com',
      'https://www.pokemondraft.com',
      'http://localhost:3000',
      'http://localhost:4001',
      '*' // Fallback to allow all origins
    ],
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true // Enable compatibility with older clients
});

// In-memory storage for lobbies
const lobbies = new Map();

// Helper to save draft session to MongoDB
async function saveDraftSession(lobby) {
  if (!lobby || !lobby.code) return;
  
  try {
    // Get existing session first to preserve all participants
    const session = await DraftSession.findOne({ lobbyCode: lobby.code });
    
    console.log(`[saveDraftSession] Saving lobby ${lobby.code}`);
    console.log(`  - Connected users: ${lobby.users.map(u => u.name).join(', ')}`);
    console.log(`  - Existing participants: ${session?.participants?.map(p => p.username).join(', ') || 'none'}`);
    
    // Build update data for currently connected users only
    const connectedUsersData = lobby.users.map(user => ({
      socketId: user.id,
      username: user.name,
      selections: (lobby.selections[user.id] || []).map(p => ({
        pokemonId: p.id,
        pokemonName: p.name,
        points: p.points || 0,
        timestamp: new Date()
      })),
      pointsRemaining: lobby.pointsRemaining[user.id] != null 
        ? lobby.pointsRemaining[user.id] 
        : lobby.settings.pointsLimit,
      isConnected: true,
      lastSeen: new Date()
    }));

    let finalParticipants;
    
    if (session && session.participants) {
      // MERGE MODE: Preserve all existing participants, only update connected users
      const existingParticipants = session.participants;
      const mergedParticipants = [...existingParticipants];
      
      // Update data for currently connected users
      connectedUsersData.forEach(connectedUser => {
        const existingIndex = mergedParticipants.findIndex(p => p.username === connectedUser.username);
        
        if (existingIndex >= 0) {
          // User exists - update their data only if we have new information
          const existing = mergedParticipants[existingIndex];
          mergedParticipants[existingIndex] = {
            ...existing,
            socketId: connectedUser.socketId,
            // Only update selections if the connected user has picks (not null/empty)
            selections: connectedUser.selections.length > 0 ? connectedUser.selections : existing.selections,
            // Only update points if we have a valid value
            pointsRemaining: connectedUser.pointsRemaining != null ? connectedUser.pointsRemaining : existing.pointsRemaining,
            isConnected: connectedUser.isConnected,
            lastSeen: connectedUser.lastSeen
          };
        } else {
          // New user - add them
          mergedParticipants.push(connectedUser);
        }
      });
      
      // Mark disconnected users as not connected (but keep their data)
      mergedParticipants.forEach(participant => {
        if (!connectedUsersData.find(u => u.username === participant.username)) {
          participant.isConnected = false;
        }
      });
      
      finalParticipants = mergedParticipants;
    } else {
      // NEW SESSION: Use connected users as initial participants
      finalParticipants = connectedUsersData;
    }
    
    console.log(`  - Final participants: ${finalParticipants.map(p => p.username).join(', ')}`);

    const sessionData = {
      lobbyCode: lobby.code,
      lobbyName: lobby.lobbyName || (session?.lobbyName) || '',
      leagueCode: lobby.leagueCode || (session?.leagueCode) || null,
      hostUsername: lobby.users.find(u => u.id === lobby.host)?.name || (session?.hostUsername),
      hostSocketId: lobby.host,
      status: lobby.draftStarted ? 'drafting' : 'lobby',
      settings: {
        pointsLimit: lobby.settings.pointsLimit,
        teamSizeLimit: lobby.settings.teamSizeLimit,
        allowTrading: lobby.settings.allowTrading || false,
        maxTradeLimit: lobby.settings.maxTradeLimit || 0,
        unlimitedTrades: lobby.settings.unlimitedTrades || false,
        genFilter: lobby.settings.genFilter || 0
      },
      participants: finalParticipants,
      // Map turn order to usernames (not socket IDs which change)
      turnOrder: (lobby.draftOrder && lobby.draftOrder.length > 0) 
        ? lobby.draftOrder.map(socketId => {
            // Try to find in connected users first
            const connectedUser = lobby.users.find(u => u.id === socketId);
            if (connectedUser) return connectedUser.name;
            
            // Try to find in merged participants (for disconnected users)
            const participant = finalParticipants.find(p => p.socketId === socketId);
            if (participant) return participant.username;
            
            // If it's already a username (from previous save), keep it
            return socketId;
          })
        : (session?.turnOrder || []),
      // Map current turn to username (not socket ID which changes)
      currentTurn: lobby.currentTurn 
        ? (() => {
            const connectedUser = lobby.users.find(u => u.id === lobby.currentTurn);
            if (connectedUser) return connectedUser.name;
            
            const participant = finalParticipants.find(p => p.socketId === lobby.currentTurn);
            if (participant) return participant.username;
            
            return lobby.currentTurn;
          })()
        : (session?.currentTurn),
      draftPokemon: lobby.draftPokemonList || (session?.draftPokemon) || [],
      pointsMap: lobby.pointsMap || (session?.pointsMap) || {},
      banList: lobby.banList || (session?.banList) || [],
      updatedAt: new Date()
    };
    
    if (session) {
      // Update existing session
      Object.assign(session, sessionData);
      await session.save();
    } else {
      // Create new session
      const newSession = new DraftSession(sessionData);
      await newSession.save();
    }
  } catch (error) {
    console.error('Failed to save draft session:', error);
  }
}

// Update just the connection status for a user (when they leave/disconnect)
async function updateUserConnectionStatus(lobbyCode, username, isConnected) {
  if (!lobbyCode || !username) return;
  
  try {
    console.log(`[updateUserConnectionStatus] ${username} in ${lobbyCode} -> ${isConnected ? 'connected' : 'disconnected'}`);
    
    const session = await DraftSession.findOne({ lobbyCode });
    if (!session) {
      console.log(`  - Session not found`);
      return;
    }
    
    const participant = session.participants.find(p => p.username === username);
    if (participant) {
      participant.isConnected = isConnected;
      participant.lastSeen = new Date();
      await session.save();
      console.log(`  - Updated connection status successfully`);
    } else {
      console.log(`  - Participant not found in session`);
    }
  } catch (error) {
    console.error('Failed to update connection status:', error);
  }
}

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

  socket.on('create_lobby', ({ name, leagueCode }, callback) => {
    const code = generateLobbyCode();
    const lobby = {
      code,
      lobbyName: '', // Host can set this later
      leagueCode: leagueCode || null, // Optional league association
      host: socket.id,
      users: [{ id: socket.id, name: name || 'Host' }],
      settings: { pointsLimit: 100, teamSizeLimit: 10, genFilter: 0 },
      pointsMap: {},
      selections: {},
      pointsRemaining: { [socket.id]: 100 },
      draftStarted: false,
      currentTurn: null,
      draftOrder: [],
      snakeDraftDirection: 1, // 1 for forward, -1 for backward
      currentRound: 0,
      tradesCompleted: {},
      playersFinishedTrading: [],
      pendingTrades: new Map()
    };
    lobbies.set(code, lobby);
    socket.join(code);
    socket.lobbyCode = code;
    
    
    callback({
      ok: true,
      code,
      lobbyName: lobby.lobbyName,
      host: socket.id,
      users: lobby.users,
      settings: lobby.settings,
      pointsMap: lobby.pointsMap,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining
    });
  });

  socket.on('join_lobby', async ({ code, name, savedPoints, savedSelections }, callback) => {
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
    }
    
    // If draft has started, mark user as connected in MongoDB
    if (lobby.draftStarted && user.name) {
      await updateUserConnectionStatus(code, user.name, true);
    }
    
    socket.join(code);
    socket.lobbyCode = code;
    
    
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
      draftStarted: lobby.draftStarted,
      leagueCode: lobby.leagueCode,
      tradesCompleted: lobby.tradesCompleted || {},
      playersFinishedTrading: lobby.playersFinishedTrading || []
      playersFinishedTrading: lobby.playersFinishedTrading || []
    });
  });

  socket.on('leave_lobby', async ({ code }) => {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    // Find username before removing from lobby
    const leavingUser = lobby.users.find(u => u.id === socket.id);
    const username = leavingUser?.name;
    
    // If draft has started, only update connection status (don't save full lobby)
    if (lobby.draftStarted && username) {
      await updateUserConnectionStatus(code, username, false);
    }
    
    lobby.users = lobby.users.filter(u => u.id !== socket.id);
    delete lobby.selections[socket.id];
    delete lobby.pointsRemaining[socket.id];
    
    socket.leave(code);
    delete socket.lobbyCode;
    
    if (lobby.users.length === 0) {
      lobbies.delete(code);
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
        currentTurn: lobby.currentTurn,
        leagueCode: lobby.leagueCode,
        tradesCompleted: lobby.tradesCompleted || {},
        playersFinishedTrading: lobby.playersFinishedTrading || []
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
      currentTurn: lobby.currentTurn,
      leagueCode: lobby.leagueCode,
      tradesCompleted: lobby.tradesCompleted || {},
      playersFinishedTrading: lobby.playersFinishedTrading || []
    });
  });
    });
  });

  socket.on('update_lobby_name', ({ code, lobbyName }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) return callback({ ok: false, error: 'Lobby not found' });
    if (lobby.host !== socket.id) return callback({ ok: false, error: 'Only host can update lobby name' });
    
    lobby.lobbyName = lobbyName || '';
    
    callback({ ok: true, lobbyName: lobby.lobbyName });
    io.to(code).emit('lobby_name_updated', { lobbyName: lobby.lobbyName });
  });

  socket.on('update_league_code', ({ code, leagueCode }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) return callback({ ok: false, error: 'Lobby not found' });
    if (lobby.host !== socket.id) return callback({ ok: false, error: 'Only host can update league code' });
    
    lobby.leagueCode = leagueCode || null;
    
    callback({ ok: true, leagueCode: lobby.leagueCode });
    io.to(code).emit('lobby_update', {
      code,
      host: lobby.host,
      users: lobby.users,
      settings: lobby.settings,
      pointsMap: lobby.pointsMap,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      currentTurn: lobby.currentTurn,
      leagueCode: lobby.leagueCode,
      tradesCompleted: lobby.tradesCompleted || {},
      playersFinishedTrading: lobby.playersFinishedTrading || []
    });
  });

  socket.on('set_points', ({ code, name, value }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) return callback({ ok: false, error: 'Lobby not found' });
    if (lobby.host !== socket.id) return callback({ ok: false, error: 'Only host can set points' });
    
    const normalizedName = name.toLowerCase();
    lobby.pointsMap[normalizedName] = Number(value);
    
    
    callback({ ok: true, pointsMap: lobby.pointsMap });
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
  });

  socket.on('import_points', ({ code, pointsMap }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) {
      return callback({ ok: false, error: 'Lobby not found' });
    }
    if (lobby.host !== socket.id) {
      return callback({ ok: false, error: 'Only host can import points' });
    }
    
    const normalized = {};
    for (const [k, v] of Object.entries(pointsMap)) {
      normalized[k.toLowerCase()] = Number(v);
    }
    
    lobby.pointsMap = { ...lobby.pointsMap, ...normalized };
    
    callback({ ok: true, pointsMap: lobby.pointsMap });
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
  });

  socket.on('load_preset', ({ code, presetId }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) {
      return callback({ ok: false, error: 'Lobby not found' });
    }
    if (lobby.host !== socket.id) {
      return callback({ ok: false, error: 'Only host can load presets' });
    }
    
    const preset = presets.find(p => p.id === presetId);
    if (!preset) {
      return callback({ ok: false, error: 'Preset not found' });
    }
    
    // Normalize and apply preset points
    const normalized = {};
    for (const [k, v] of Object.entries(preset.points)) {
      normalized[k.toLowerCase()] = Number(v);
    }
    
    lobby.pointsMap = { ...lobby.pointsMap, ...normalized };
    
    // Update lobby settings if preset has them
    if (preset.pointsLimit) lobby.settings.pointsLimit = preset.pointsLimit;
    if (preset.teamSizeLimit) lobby.settings.teamSizeLimit = preset.teamSizeLimit;
    if (preset.generationFilter) lobby.settings.genFilter = preset.generationFilter;
    
    
    callback({ ok: true, pointsMap: lobby.pointsMap, settings: lobby.settings });
    io.to(code).emit('pointsMap_update', { pointsMap: lobby.pointsMap });
    io.to(code).emit('lobby_update', {
      code: lobby.code,
      host: lobby.host,
      users: lobby.users,
      settings: lobby.settings,
      leagueCode: lobby.leagueCode
    });
  });

  socket.on('start_draft', async ({ code }, callback) => {
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
    lobby.snakeDraftDirection = 1; // Start going forward
    lobby.currentRound = 0;
    
    // Save draft session when starting
    await saveDraftSession(lobby);
    
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
      draftStarted: true,
      leagueCode: lobby.leagueCode,
      tradesCompleted: lobby.tradesCompleted || {},
      playersFinishedTrading: lobby.playersFinishedTrading || []
    });
  });

  socket.on('select_pokemon', async ({ code, name, pokemon }) => {
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
    
    // Snake draft turn advancement
    const currentIndex = lobby.draftOrder.indexOf(lobby.currentTurn);
    const direction = lobby.snakeDraftDirection || 1;
    let nextIndex = currentIndex + direction;
    
    // Check if we've reached the end and need to reverse direction
    if (nextIndex >= lobby.draftOrder.length) {
      // Hit the end going forward, reverse direction
      lobby.snakeDraftDirection = -1;
      nextIndex = lobby.draftOrder.length - 1; // Stay at last player
      lobby.currentRound++;
    } else if (nextIndex < 0) {
      // Hit the start going backward, reverse direction
      lobby.snakeDraftDirection = 1;
      nextIndex = 0; // Stay at first player
      lobby.currentRound++;
    }
    
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
      // Move in the current direction to find next active player
      nextIndex = nextIndex + (lobby.snakeDraftDirection || 1);
      if (nextIndex >= lobby.draftOrder.length) {
        nextIndex = lobby.draftOrder.length - 1;
        lobby.snakeDraftDirection = -1;
      } else if (nextIndex < 0) {
        nextIndex = 0;
        lobby.snakeDraftDirection = 1;
      }
      attempts++;
    }
    
    
    // Check if draft is complete (all players have reached team size limit)
    const teamSizeLimit = lobby.settings.teamSizeLimit || 10;
    const allPlayersComplete = lobby.users.every(user => {
      const userSelections = lobby.selections[user.id] || [];
      return userSelections.length >= teamSizeLimit;
    });
    
    if (allPlayersComplete) {
      // Save completed draft to MongoDB
      await saveDraftSession(lobby);
      io.to(code).emit('draft_complete', {
        selections: lobby.selections,
        users: lobby.users
      });
    }
    
    // Save after each selection
    await saveDraftSession(lobby);
    
    io.to(code).emit('user_selected', {
      userId: socket.id,
      name,
      pokemon
    });
    io.to(code).emit('selections_update', { selections: lobby.selections });
    io.to(code).emit('points_update', { pointsRemaining: lobby.pointsRemaining });
    io.to(code).emit('turn_update', { currentTurn: lobby.currentTurn });
  });

  // Trading phase handlers
  socket.on('start_trading_phase', ({ code, settings }) => {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    
    // Initialize trading state
    if (!lobby.tradesCompleted) {
      lobby.tradesCompleted = {};
      lobby.users.forEach(user => {
        lobby.tradesCompleted[user.id] = 0;
      });
    }
    if (!lobby.playersFinishedTrading) {
      lobby.playersFinishedTrading = [];
    }
    if (!lobby.pendingTrades) {
      lobby.pendingTrades = new Map();
    }
    
    // Broadcast to all players
    io.to(code).emit('trading_phase_start', {
      settings: settings || lobby.settings
    });
  });

  socket.on('offer_trade', ({ code, from, to, pokemon1, pokemon2 }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) {
      return callback?.({ ok: false, error: 'Lobby not found' });
    }
    
    
    // Initialize trading state if needed
    if (!lobby.tradesCompleted) {
      lobby.tradesCompleted = {};
    }
    if (!lobby.pendingTrades) {
      lobby.pendingTrades = new Map();
    }
    if (!lobby.playersFinishedTrading) {
      lobby.playersFinishedTrading = [];
    }
    
    // Check if either player has finished trading
    if (lobby.playersFinishedTrading.includes(from)) {
      return callback?.({ ok: false, error: 'You have already finished trading' });
    }
    if (lobby.playersFinishedTrading.includes(to)) {
      return callback?.({ ok: false, error: 'That player has already finished trading' });
    }
    
    // Check trade limits
    const fromTrades = lobby.tradesCompleted[from] || 0;
    const toTrades = lobby.tradesCompleted[to] || 0;
    const maxTrades = lobby.settings.maxTradeLimit || 0;
    const unlimited = lobby.settings.unlimitedTrades;
    
    if (!unlimited && fromTrades >= maxTrades) {
      return callback?.({ ok: false, error: 'You have reached your trade limit' });
    }
    if (!unlimited && toTrades >= maxTrades) {
      return callback?.({ ok: false, error: 'Other player has reached their trade limit' });
    }
    
    // Create trade ID
    const tradeId = `${Date.now()}_${from}_${to}`;
    
    // Store pending trade
    lobby.pendingTrades.set(tradeId, {
      from,
      to,
      pokemon1,
      pokemon2,
      timestamp: Date.now()
    });
    
    // Find names
    const fromUser = lobby.users.find(u => u.id === from);
    const toUser = lobby.users.find(u => u.id === to);
    
    // Notify the recipient
    io.to(to).emit('trade_offer_received', {
      tradeId,
      from,
      to,
      fromName: fromUser?.name || 'Unknown',
      pokemon1,
      pokemon2
    });
    
    callback?.({ ok: true });
  });

  socket.on('accept_trade', ({ code, tradeId }) => {
    const lobby = lobbies.get(code);
    if (!lobby || !lobby.pendingTrades) return;
    
    const trade = lobby.pendingTrades.get(tradeId);
    if (!trade) {
      return;
    }
    
    
    // Swap the Pokemon
    const fromSelections = lobby.selections[trade.from] || [];
    const toSelections = lobby.selections[trade.to] || [];
    
    const fromIndex = fromSelections.findIndex(p => p.name === trade.pokemon1);
    const toIndex = toSelections.findIndex(p => p.name === trade.pokemon2);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      // Swap
      const temp = fromSelections[fromIndex];
      fromSelections[fromIndex] = toSelections[toIndex];
      toSelections[toIndex] = temp;
      
      lobby.selections[trade.from] = fromSelections;
      lobby.selections[trade.to] = toSelections;
      
      // Increment trade counts
      lobby.tradesCompleted[trade.from] = (lobby.tradesCompleted[trade.from] || 0) + 1;
      lobby.tradesCompleted[trade.to] = (lobby.tradesCompleted[trade.to] || 0) + 1;
      
      // Remove pending trade
      lobby.pendingTrades.delete(tradeId);
      
      // Notify both players
      io.to(code).emit('trade_accepted', {
        updatedSelections: lobby.selections,
        tradesCompleted: lobby.tradesCompleted
      });
      
    }
  });

  socket.on('decline_trade', ({ code, tradeId }) => {
    const lobby = lobbies.get(code);
    if (!lobby || !lobby.pendingTrades) return;
    
    const trade = lobby.pendingTrades.get(tradeId);
    if (!trade) return;
    
    
    // Remove pending trade
    lobby.pendingTrades.delete(tradeId);
    
    // Notify the offerer
    io.to(trade.from).emit('trade_declined');
  });

  socket.on('trade_for_unpicked', ({ code, playerId, oldPokemon, newPokemon, newPokemonData }, callback) => {
    const lobby = lobbies.get(code);
    if (!lobby) {
      return callback?.({ ok: false, error: 'Lobby not found' });
    }
    
    
    // Initialize trading state if needed
    if (!lobby.tradesCompleted) {
      lobby.tradesCompleted = {};
    }
    if (!lobby.playersFinishedTrading) {
      lobby.playersFinishedTrading = [];
    }
    
    // Check if player has finished trading
    if (lobby.playersFinishedTrading.includes(playerId)) {
      return callback?.({ ok: false, error: 'You have already finished trading' });
    }
    
    // Check trade limit
    const playerTrades = lobby.tradesCompleted[playerId] || 0;
    const maxTrades = lobby.settings.maxTradeLimit || 0;
    const unlimited = lobby.settings.unlimitedTrades;
    
    if (!unlimited && playerTrades >= maxTrades) {
      return callback?.({ ok: false, error: 'You have reached your trade limit' });
    }
    
    // Find and replace the Pokemon
    const playerSelections = lobby.selections[playerId] || [];
    const pokemonIndex = playerSelections.findIndex(p => p.name === oldPokemon);
    
    if (pokemonIndex !== -1) {
      // Use the full Pokemon data if provided, otherwise create minimal object
      let newPokemonObj;
      if (newPokemonData && newPokemonData.id) {
        // Client sent full Pokemon data, use it
        newPokemonObj = {
          id: newPokemonData.id,
          name: newPokemonData.name,
          img: newPokemonData.img,
          abilities: newPokemonData.abilities,
          moves: newPokemonData.moves,
          stats: newPokemonData.stats
        };
      } else {
        // Fallback to minimal object (client will reconstruct)
        const oldPokemonData = playerSelections[pokemonIndex];
        newPokemonObj = {
          name: newPokemon,
          id: undefined,
          img: undefined,
          ...oldPokemonData,
          name: newPokemon
        };
      }
      
      playerSelections[pokemonIndex] = newPokemonObj;
      lobby.selections[playerId] = playerSelections;
      
      // Increment trade count
      lobby.tradesCompleted[playerId] = (lobby.tradesCompleted[playerId] || 0) + 1;
      
      // Notify all players with full selection data
      io.to(code).emit('unpicked_trade_completed', {
        updatedSelections: lobby.selections,
        tradesCompleted: lobby.tradesCompleted,
        playerId: playerId,
        newPokemonName: newPokemon,
        pokemonIndex: pokemonIndex
      });
      
      callback?.({ ok: true });
      
    } else {
      callback?.({ ok: false, error: 'Pokemon not found in your team' });
    }
  });

  socket.on('finish_trading', ({ code }) => {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    if (!lobby.playersFinishedTrading) {
      lobby.playersFinishedTrading = [];
    }
    
    if (!lobby.playersFinishedTrading.includes(socket.id)) {
      lobby.playersFinishedTrading.push(socket.id);
    }
    
    // Notify all players
    io.to(code).emit('player_finished_trading', {
      playersFinished: lobby.playersFinishedTrading
    });
    
    // Check if all players are finished
    if (lobby.playersFinishedTrading.length === lobby.users.length) {
      io.to(code).emit('all_players_finished_trading');
    }
  });

  socket.on('disconnect', async () => {
    
    if (socket.lobbyCode) {
      const lobby = lobbies.get(socket.lobbyCode);
      if (lobby) {
        // Find username before removing from lobby
        const disconnectingUser = lobby.users.find(u => u.id === socket.id);
        const username = disconnectingUser?.name;
        
        // If draft has started, only update connection status (don't save full lobby)
        if (lobby.draftStarted && username) {
          await updateUserConnectionStatus(socket.lobbyCode, username, false);
        }
        
        lobby.users = lobby.users.filter(u => u.id !== socket.id);
        
        if (lobby.users.length === 0) {
          lobbies.delete(socket.lobbyCode);
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
            currentTurn: lobby.currentTurn,
            leagueCode: lobby.leagueCode,
            tradesCompleted: lobby.tradesCompleted || {},
            playersFinishedTrading: lobby.playersFinishedTrading || []
          });
        }
      }
    }
  });
});

server.listen(PORT, () => {
});
