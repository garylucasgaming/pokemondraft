const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, // Hashed password
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '' }, // URL or identifier
  devices: [{
    fingerprint: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
    userAgent: String,
    trusted: { type: Boolean, default: true }
  }],
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  isActive: { type: Boolean, default: true }
});

// League Schema
const leagueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true }, // Like lobby codes
  commissionerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  commissionerName: { type: String, required: true }, // Cached for display
  format: { type: String, required: true }, // e.g., "National Dex", "VGC 2024"
  rules: {
    pointsLimit: { type: Number, default: 100 },
    teamSize: { type: Number, default: 6 },
    allowedGenerations: [Number],
    bannedPokemon: [String]
  },
  status: { type: String, enum: ['open', 'in_progress', 'completed'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

// Player Schema
const playerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true }, // Cached for display
  leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
  team: [{
    name: String,
    points: Number
  }],
  totalPoints: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  standing: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now }
});

// Match Schema
const matchSchema = new mongoose.Schema({
  leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
  player1: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  player2: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  score: { type: String }, // e.g., "2-1", "3-0"
  replayUrl: { type: String },
  notes: { type: String },
  week: { type: Number }, // For league play
  round: { type: Number }, // For tournament play
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed'], default: 'scheduled' },
  playedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Tournament Schema
const tournamentSchema = new mongoose.Schema({
  leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
  name: { type: String, required: true },
  format: { type: String, enum: ['single_elimination', 'double_elimination', 'round_robin'], default: 'single_elimination' },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  bracket: { type: Object }, // Store bracket structure as JSON
  currentRound: { type: Number, default: 1 },
  status: { type: String, enum: ['setup', 'in_progress', 'completed'], default: 'setup' },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  startedAt: { type: Date },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Saved Team Schema
const savedTeamSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for guest users
  username: { type: String, required: true }, // Cached for display
  name: { type: String, required: true },
  pokemon: [{
    name: { type: String, required: true },
    moves: [String],
    ability: String,
    item: String,
    nature: String,
    teraType: String,
    evs: {
      hp: { type: Number, default: 0 },
      attack: { type: Number, default: 0 },
      defense: { type: Number, default: 0 },
      specialAttack: { type: Number, default: 0 },
      specialDefense: { type: Number, default: 0 },
      speed: { type: Number, default: 0 }
    },
    ivs: {
      hp: { type: Number, default: 31 },
      attack: { type: Number, default: 31 },
      defense: { type: Number, default: 31 },
      specialAttack: { type: Number, default: 31 },
      specialDefense: { type: Number, default: 31 },
      speed: { type: Number, default: 31 }
    },
    level: { type: Number, default: 50 },
    gender: String,
    shiny: { type: Boolean, default: false }
  }],
  format: String, // 'SV OU', 'VGC 2024', 'National Dex', etc.
  description: String,
  isPublic: { type: Boolean, default: false },
  teamBuilderData: mongoose.Schema.Types.Mixed, // Store team builder format data
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Draft Session Schema - for ongoing drafts
const draftSessionSchema = new mongoose.Schema({
  lobbyCode: { type: String, required: true, unique: true },
  lobbyName: { type: String, default: '' }, // Host-set lobby name
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: link to user if authenticated
  hostUsername: { type: String }, // Username of the host
  hostSocketId: { type: String }, // Current socket ID for reconnection
  status: { type: String, enum: ['lobby', 'drafting', 'completed', 'abandoned'], default: 'lobby' },
  settings: {
    pointsLimit: { type: Number, default: 100 },
    teamSizeLimit: { type: Number, default: 10 },
    allowTrading: { type: Boolean, default: false },
    maxTradeLimit: { type: Number, default: 0 },
    unlimitedTrades: { type: Boolean, default: false },
    genFilter: { type: Number, default: 0 },
    timerEnabled: { type: Boolean, default: false },
    firstRoundTimer: { type: Number, default: 480 }, // in minutes, default 8 hours (480 minutes)
    subsequentRoundTimer: { type: Number, default: 480 } // in minutes, default 8 hours
  },
  currentTurnStartTime: { type: Date }, // When current player's turn started
  skippedPlayers: [{ type: String }], // Usernames of players whose turns were skipped
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: if authenticated
    socketId: { type: String }, // Last known socket ID
    username: { type: String, required: true },
    selections: [{
      pokemonId: Number,
      pokemonName: String,
      points: Number,
      timestamp: { type: Date, default: Date.now }
    }],
    pointsRemaining: { type: Number },
    isConnected: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now }
  }],
  turnOrder: [String], // Array of usernames or socket IDs
  currentTurn: { type: String }, // Username or socket ID of current player
  draftPokemon: [{
    id: Number,
    name: String,
    points: Number,
    legendary: Boolean,
    generation: Number
  }],
  pointsMap: { type: Map, of: Number }, // Pokemon name -> points
  banList: [String], // Banned pokemon names
  presetUsed: { type: String }, // Preset ID if one was loaded
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  startedAt: { type: Date }, // When draft actually started
  completedAt: { type: Date }, // When draft finished
  expiresAt: { type: Date, default: () => Date.now() + 90 * 24 * 60 * 60 * 1000 } // 90 days
});

// Create indexes for better query performance
// Note: code and shareCode already have unique indexes from schema definition
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
playerSchema.index({ leagueId: 1, userId: 1 });
playerSchema.index({ userId: 1 });
matchSchema.index({ leagueId: 1, week: 1 });
tournamentSchema.index({ leagueId: 1 });
savedTeamSchema.index({ userId: 1 });
savedTeamSchema.index({ isPublic: 1, createdAt: -1 });
draftSessionSchema.index({ lobbyCode: 1 });
draftSessionSchema.index({ 'participants.userId': 1 });
draftSessionSchema.index({ 'participants.username': 1 }); // For username search
draftSessionSchema.index({ lobbyName: 'text' }); // Text search for lobby names
draftSessionSchema.index({ status: 1, expiresAt: 1 }); // For cleanup queries
draftSessionSchema.index({ expiresAt: 1 }); // TTL index for auto-deletion

module.exports = {
  User: mongoose.model('User', userSchema),
  League: mongoose.model('League', leagueSchema),
  Player: mongoose.model('Player', playerSchema),
  Match: mongoose.model('Match', matchSchema),
  Tournament: mongoose.model('Tournament', tournamentSchema),
  SavedTeam: mongoose.model('SavedTeam', savedTeamSchema),
  DraftSession: mongoose.model('DraftSession', draftSessionSchema)
};
