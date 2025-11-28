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
  commissionerName: { type: String, required: true }, // Username of creator
  imageUrl: { type: String }, // Base64 or URL for league image
  isPublic: { type: Boolean, default: true },
  maxPlayers: { type: Number, default: 8 },
  splitIntoPools: { type: Boolean, default: false },
  numPools: { type: Number, default: 1 },
  leagueWeeks: { type: Number, default: 8 },
  bracketType: { type: String, enum: ['round_robin', 'swiss', 'single_elimination', 'double_elimination'], default: 'round_robin' },
  format: { type: String }, // e.g., "National Dex", "VGC 2024" - configured later
  rules: {
    pointsLimit: { type: Number, default: 100 },
    teamSize: { type: Number, default: 6 },
    allowedGenerations: [Number],
    bannedPokemon: [String],
    allowMega: { type: Boolean, default: false },
    allowGmax: { type: Boolean, default: false },
    allowTrading: { type: Boolean, default: false },
    maxTradeLimit: { type: Number, default: 0 },
    unlimitedTrades: { type: Boolean, default: false },
    allowSeasonalTrading: { type: Boolean, default: false },
    maxSeasonalTradeLimit: { type: Number, default: 1 },
    unlimitedSeasonalTrades: { type: Boolean, default: false },
    timerEnabled: { type: Boolean, default: false },
    firstRoundTimer: { type: Number, default: 720 },
    subsequentRoundTimer: { type: Number, default: 360 }
  },
  captainRules: {
    captainCount: { type: Number, default: 2 },
    allowMegaCaptains: { type: Boolean, default: false },
    allowTeraCaptains: { type: Boolean, default: false },
    allowGmaxCaptains: { type: Boolean, default: false },
    allowZMoveCaptains: { type: Boolean, default: false },
    bannedCaptains: [{ type: String }]
  },
  pokemonPointValues: { type: Map, of: Number }, // Map of pokemon name -> point value
  draftRules: { type: String }, // Custom draft rules text
  battleRules: { type: String }, // Custom battle rules text
  pendingPlayers: [{ type: String }], // Array of usernames requesting to join
  inviteCodes: [{
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  }],
  schedule: [{
    id: { type: String, required: true },
    type: { type: String, enum: ['draft_start', 'match', 'meeting', 'playoffs_start', 'playoffs_end', 'league_end', 'custom'], required: true },
    date: { type: Date, required: true },
    notes: { type: String, default: '' },
    dateDisplay: { type: String },
    players: [{ type: String }] // Array of player usernames
  }],
  bracket: {
    type: { type: String, enum: ['round_robin', 'single_elimination', 'double_elimination', 'swiss'] },
    matches: [{
      id: String,
      player1: String,
      player2: String,
      winner: String,
      score: String,
      week: Number,
      round: Number,
      nextMatchId: String,
      replay: String
    }]
  },
  playoffBracket: {
    started: { type: Boolean, default: false },
    matches: [{
      id: String,
      player1: String,
      player2: String,
      winner: String,
      score: String,
      week: Number,
      round: Number,
      matchNumber: Number,
      nextMatchId: String,
      replayLink: String,
      flaggedWinner: String,
      flaggedBy: String,
      needsApproval: Boolean
    }]
  },
  status: { type: String, enum: ['open', 'in_progress', 'completed'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

// Player Schema
const playerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional - for when user accounts are implemented
  username: { type: String, required: true }, // Primary identifier for now
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
  leagueCode: { type: String }, // Optional: Link to a league if this draft is part of one
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
// Note: code, shareCode, email, username, and lobbyCode already have unique indexes from schema definition
playerSchema.index({ leagueId: 1, userId: 1 });
playerSchema.index({ userId: 1 });
matchSchema.index({ leagueId: 1, week: 1 });
tournamentSchema.index({ leagueId: 1 });
savedTeamSchema.index({ userId: 1 });
savedTeamSchema.index({ isPublic: 1, createdAt: -1 });
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
