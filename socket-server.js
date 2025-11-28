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
  allowEIO3: true, // Enable compatibility with older clients
  maxHttpBufferSize: 1e8, // 100 MB - increase from default 1MB to handle large pokemon lists
  pingTimeout: 60000 // 60 seconds before considering connection dead
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
      selections: (lobby.selections[user.name] || lobby.selections[user.id] || []).map(p => ({
        pokemonId: p.id,
        pokemonName: p.name,
        points: p.points || 0,
        timestamp: new Date()
      })),
      pointsRemaining: lobby.pointsRemaining[user.name] != null 
        ? lobby.pointsRemaining[user.name]
        : lobby.pointsRemaining[user.id] != null 
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
        genFilter: lobby.settings.genFilter || 0,
        timerEnabled: lobby.settings.timerEnabled || false,
        firstRoundTimer: lobby.settings.firstRoundTimer || 480,
        subsequentRoundTimer: lobby.settings.subsequentRoundTimer || 480,
        allowMega: lobby.settings.allowMega || false,
        allowGmax: lobby.settings.allowGmax || false
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
      currentTurnStartTime: lobby.currentTurnStartTime || (session?.currentTurnStartTime) || null,
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

  socket.on('create_lobby', ({ name, leagueCode, settings, pointsMap, banList }, callback) => {
    const code = generateLobbyCode();
    
    // Use provided settings or defaults
    const lobbySettings = settings || { pointsLimit: 100, teamSizeLimit: 10, genFilter: 0 };
    const initialPointsLimit = lobbySettings.pointsLimit || 100;
    
    const lobby = {
      code,
      lobbyName: '', // Host can set this later
      leagueCode: leagueCode || null, // Optional league association
      host: socket.id,
      users: [{ id: socket.id, name: name || 'Host' }],
      settings: lobbySettings,
      pointsMap: pointsMap || {},
      banList: banList || [],
      selections: {},
      pointsRemaining: { 
        [socket.id]: initialPointsLimit,
        [name || 'Host']: initialPointsLimit  // Also store by username
      },
      draftStarted: false,
      currentTurn: null,
      currentTurnStartTime: null, // ISO timestamp when current turn started
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
      leagueCode: lobby.leagueCode,
      host: socket.id,
      users: lobby.users,
      settings: lobby.settings,
      pointsMap: lobby.pointsMap,
      banList: lobby.banList,
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
    // Store by BOTH socket ID and username for persistence
    lobby.pointsRemaining[socket.id] = savedPoints != null ? savedPoints : lobby.settings.pointsLimit;
    lobby.pointsRemaining[user.name] = savedPoints != null ? savedPoints : lobby.settings.pointsLimit;
    
    // Restore saved selections if provided
    // Store by BOTH socket ID and username for persistence
    if (savedSelections && Array.isArray(savedSelections) && savedSelections.length > 0) {
      lobby.selections[socket.id] = savedSelections;
      lobby.selections[user.name] = savedSelections;
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
      banList: lobby.banList,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      draftOrder: lobby.draftOrder,
      currentTurn: lobby.currentTurn,
      currentTurnStartTime: lobby.currentTurnStartTime,
      draftStarted: lobby.draftStarted,
      leagueCode: lobby.leagueCode,
      tradesCompleted: lobby.tradesCompleted || {},
      playersFinishedTrading: lobby.playersFinishedTrading || []
    });
  });

  // Rejoin an ongoing draft from MongoDB (recreate lobby if needed)
  socket.on('rejoin_draft_lobby', async ({ code, username }, callback) => {
    try {
      // Try to get existing lobby first
      let lobby = lobbies.get(code);
      
      // If lobby doesn't exist in memory, recreate it from MongoDB
      if (!lobby) {
        const session = await DraftSession.findOne({ lobbyCode: code });
        if (!session) {
          return callback({ ok: false, error: 'Draft not found in database' });
        }
        
        // Recreate lobby from MongoDB data
        lobby = {
          code: code,
          lobbyName: session.lobbyName || '',
          leagueCode: session.leagueCode || null,
          host: null, // Will be set to first rejoining player
          users: [], // Will be populated as players rejoin
          settings: session.settings || { pointsLimit: 100, teamSizeLimit: 10, genFilter: 0 },
          pointsMap: session.pointsMap || {},
          banList: session.banList || [],
          selections: {}, // Will be populated from participants
          pointsRemaining: {}, // Will be populated from participants
          draftStarted: true,
          currentTurn: session.currentTurn, // Username-based
          currentTurnStartTime: session.currentTurnStartTime,
          draftOrder: session.turnOrder || [], // Username-based
          draftPokemonList: session.draftPokemon || [],
          snakeDraftDirection: 1,
          currentRound: 0,
          tradesCompleted: {},
          playersFinishedTrading: [],
          pendingTrades: new Map()
        };
        
        // No need to add img property - client can generate it from pokemon.id
        
        // Restore selections and points from participants
        if (session.participants && Array.isArray(session.participants)) {
          console.log(`[Rejoin] Restoring ${session.participants.length} participants from MongoDB`);
          session.participants.forEach(participant => {
            console.log(`[Rejoin] Processing participant: ${participant.username}, selections count: ${participant.selections?.length || 0}`);
            
            // Convert MongoDB selection format to client format
            const selections = (participant.selections || []).map(s => ({
              id: s.pokemonId,
              name: s.pokemonName,
              points: s.points || 0,
              img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.pokemonId}.png`
            }));
            
            console.log(`[Rejoin] Converted selections for ${participant.username}:`, selections);
            
            // Store by username (server now uses username-based turn system)
            lobby.selections[participant.username] = selections;
            lobby.pointsRemaining[participant.username] = participant.pointsRemaining;
          });
          
          console.log(`[Rejoin] Final lobby.selections keys:`, Object.keys(lobby.selections));
        }
        
        // DON'T recalculate draft pokemon list - MongoDB already has the filtered list!
        // The draftPokemonList is updated in real-time during select_pokemon,
        // so session.draftPokemon already has picked pokemon removed.
        console.log(`[Rejoin] Using draftPokemonList from MongoDB: ${lobby.draftPokemonList?.length || 0} pokemon available`);
        
        lobbies.set(code, lobby);
        console.log(`[Rejoin] Recreated lobby ${code} from MongoDB`);
      }
      
      // Add rejoining user to lobby
      const existingUser = lobby.users.find(u => u.name === username);
      if (existingUser) {
        // User already in lobby (shouldn't happen, but update socket ID)
        existingUser.id = socket.id;
      } else {
        lobby.users.push({ id: socket.id, name: username });
      }
      
      // Set host if not already set
      if (!lobby.host) {
        lobby.host = socket.id;
      }
      
      // Map selections and points by socket ID (in addition to username)
      // IMPORTANT: Keep BOTH username and socket.id keys so clients can find their data either way
      if (lobby.selections[username]) {
        lobby.selections[socket.id] = lobby.selections[username];
        // Don't delete the username key - we need both!
        console.log(`[Rejoin] Mapped selections for ${username}: ${lobby.selections[username].length} pokemon`);
        console.log(`[Rejoin] Now available under both username "${username}" and socket.id "${socket.id}"`);
      } else {
        console.log(`[Rejoin] No selections found for username: ${username}`);
      }
      if (lobby.pointsRemaining[username] != null) {
        lobby.pointsRemaining[socket.id] = lobby.pointsRemaining[username];
        // Don't delete the username key - we need both!
        console.log(`[Rejoin] Mapped points for ${username}: ${lobby.pointsRemaining[username]} points`);
      } else {
        console.log(`[Rejoin] No points found for username: ${username}`);
      }
      
      socket.join(code);
      socket.lobbyCode = code;
      
      // Update connection status in MongoDB
      await updateUserConnectionStatus(code, username, true);
      
      console.log(`[Rejoin] Before callback - selections keys:`, Object.keys(lobby.selections));
      console.log(`[Rejoin] Before callback - checking username key "${username}":`, !!lobby.selections[username]);
      console.log(`[Rejoin] Before callback - checking socket.id key "${socket.id}":`, !!lobby.selections[socket.id]);
      console.log(`[Rejoin] Sending callback with selections:`, Object.keys(lobby.selections));
      
      callback({
        ok: true,
        code,
        host: lobby.host,
        users: lobby.users,
        settings: lobby.settings,
        pointsMap: lobby.pointsMap,
        banList: lobby.banList,
        selections: lobby.selections,
        pointsRemaining: lobby.pointsRemaining,
        draftOrder: lobby.draftOrder,
        currentTurn: lobby.currentTurn,
        currentTurnStartTime: lobby.currentTurnStartTime,
        draftStarted: lobby.draftStarted,
        draftPokemonList: lobby.draftPokemonList,
        leagueCode: lobby.leagueCode
      });
      
      // Notify other players in the lobby
      io.to(code).emit('lobby_update', {
        code,
        host: lobby.host,
        users: lobby.users,
        settings: lobby.settings,
        pointsMap: lobby.pointsMap,
        banList: lobby.banList,
        selections: lobby.selections,
        pointsRemaining: lobby.pointsRemaining,
        draftOrder: lobby.draftOrder,
        currentTurn: lobby.currentTurn,
        currentTurnStartTime: lobby.currentTurnStartTime,
        draftStarted: lobby.draftStarted,
        leagueCode: lobby.leagueCode,
        tradesCompleted: lobby.tradesCompleted || {},
        playersFinishedTrading: lobby.playersFinishedTrading || []
      });
      
      console.log(`[Rejoin] ${username} rejoined lobby ${code}`);
    } catch (error) {
      console.error('[Rejoin] Error:', error);
      callback({ ok: false, error: error.message });
    }
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
        banList: lobby.banList,
        selections: lobby.selections,
        pointsRemaining: lobby.pointsRemaining,
        draftOrder: lobby.draftOrder,
        currentTurn: lobby.currentTurn,
        currentTurnStartTime: lobby.currentTurnStartTime,
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
      banList: lobby.banList,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      currentTurn: lobby.currentTurn,
      currentTurnStartTime: lobby.currentTurnStartTime,
      leagueCode: lobby.leagueCode,
      tradesCompleted: lobby.tradesCompleted || {},
      playersFinishedTrading: lobby.playersFinishedTrading || []
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
      banList: lobby.banList,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      currentTurn: lobby.currentTurn,
      currentTurnStartTime: lobby.currentTurnStartTime,
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
      pointsMap: lobby.pointsMap,
      banList: lobby.banList,
      leagueCode: lobby.leagueCode
    });
  });

  socket.on('start_draft', async ({ code, draftPokemonList }, callback) => {
    console.log(`[Start Draft] Received request for lobby ${code}`);
    console.log(`[Start Draft] draftPokemonList length:`, draftPokemonList?.length || 0);
    
    const lobby = lobbies.get(code);
    if (!lobby) {
      console.log(`[Start Draft] ERROR: Lobby not found: ${code}`);
      return callback({ ok: false, error: 'Lobby not found' });
    }
    if (lobby.host !== socket.id) {
      console.log(`[Start Draft] ERROR: Not host. Socket ID: ${socket.id}, Host: ${lobby.host}`);
      return socket.emit('start_rejected', { reason: 'not_host' });
    }
    
    lobby.draftStarted = true;
    // Store the initial pokemon list from client
    if (draftPokemonList && Array.isArray(draftPokemonList)) {
      lobby.draftPokemonList = draftPokemonList;
      console.log(`[Start Draft] Saved draftPokemonList: ${draftPokemonList.length} pokemon`);
    } else {
      console.log(`[Start Draft] WARNING: No valid draftPokemonList received!`);
    }
    // Randomize draft order using Fisher-Yates shuffle with USERNAMES (not socket IDs)
    const usernames = lobby.users.map(u => u.name);
    for (let i = usernames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [usernames[i], usernames[j]] = [usernames[j], usernames[i]];
    }
    lobby.draftOrder = usernames;
    lobby.currentTurn = lobby.draftOrder[0];
    lobby.currentTurnStartTime = new Date().toISOString(); // Set timer start
    lobby.snakeDraftDirection = 1; // Start going forward
    lobby.currentRound = 0;
    
    // Initialize points and selections by username (in addition to socket ID) for persistence
    lobby.users.forEach(user => {
      // Copy socket.id-keyed data to username keys
      if (lobby.pointsRemaining[user.id] != null && !lobby.pointsRemaining[user.name]) {
        lobby.pointsRemaining[user.name] = lobby.pointsRemaining[user.id];
      }
      if (lobby.selections[user.id] && !lobby.selections[user.name]) {
        lobby.selections[user.name] = lobby.selections[user.id];
      }
    });
    
    // Save draft session when starting
    try {
      await saveDraftSession(lobby);
      console.log(`[Start Draft] Successfully saved to MongoDB`);
    } catch (error) {
      console.error(`[Start Draft] Failed to save to MongoDB:`, error);
      // Continue anyway - don't block the draft from starting
    }
    
    console.log(`[Start Draft] Sending callback with ok: true`);
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
      banList: lobby.banList,
      selections: lobby.selections,
      pointsRemaining: lobby.pointsRemaining,
      draftOrder: lobby.draftOrder,
      currentTurn: lobby.currentTurn,
      currentTurnStartTime: lobby.currentTurnStartTime,
      draftStarted: true,
      leagueCode: lobby.leagueCode,
      tradesCompleted: lobby.tradesCompleted || {},
      playersFinishedTrading: lobby.playersFinishedTrading || []
    });
  });

  socket.on('select_pokemon', async ({ code, name, pokemon }) => {
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    // Validate turn by USERNAME (not socket ID) so rejoining players can pick
    const currentUser = lobby.users.find(u => u.id === socket.id);
    if (!currentUser || lobby.currentTurn !== currentUser.name) {
      return socket.emit('select_rejected', { pokemon, reason: 'not_your_turn' });
    }
    
    const cost = lobby.pointsMap[pokemon.name] != null ? lobby.pointsMap[pokemon.name] : 1;
    // Check points by username first, then socket ID as fallback
    const remaining = lobby.pointsRemaining[currentUser.name] != null 
      ? lobby.pointsRemaining[currentUser.name]
      : lobby.pointsRemaining[socket.id] || 0;
    
    if (remaining < cost) {
      return socket.emit('select_rejected', { pokemon, reason: 'insufficient_points' });
    }
    
    // Check if already selected
    for (const selections of Object.values(lobby.selections)) {
      if (Array.isArray(selections) && selections.some(p => p.id === pokemon.id)) {
        return socket.emit('select_rejected', { pokemon, reason: 'already_selected' });
      }
    }
    
    // Store selections by BOTH username and socket ID for compatibility
    if (!lobby.selections[currentUser.name]) {
      lobby.selections[currentUser.name] = [];
    }
    if (!lobby.selections[socket.id]) {
      lobby.selections[socket.id] = [];
    }
    lobby.selections[currentUser.name].push(pokemon);
    lobby.selections[socket.id].push(pokemon);
    
    // Store points by BOTH username and socket ID
    lobby.pointsRemaining[currentUser.name] = remaining - cost;
    lobby.pointsRemaining[socket.id] = remaining - cost;
    
    // Remove picked pokemon from the available draft list
    if (lobby.draftPokemonList && Array.isArray(lobby.draftPokemonList)) {
      lobby.draftPokemonList = lobby.draftPokemonList.filter(p => p.id !== pokemon.id);
    }
    
    // Snake draft turn advancement (using USERNAMES)
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
    
    // Simply advance to next player in turn order (username-based)
    // Players can be disconnected but still in turn order - they can rejoin and pick
    lobby.currentTurn = lobby.draftOrder[nextIndex];
    lobby.currentTurnStartTime = new Date().toISOString(); // Reset timer for new turn
    
    
    // Check if draft is complete (all players have reached team size limit)
    const teamSizeLimit = lobby.settings.teamSizeLimit || 10;
    const allPlayersComplete = lobby.draftOrder.every(username => {
      const userSelections = lobby.selections[username] || [];
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
            banList: lobby.banList,
            selections: lobby.selections,
            pointsRemaining: lobby.pointsRemaining,
            draftOrder: lobby.draftOrder,
            currentTurn: lobby.currentTurn,
            currentTurnStartTime: lobby.currentTurnStartTime,
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
