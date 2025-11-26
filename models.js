const mongoose = require('mongoose');

// League Schema
const leagueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true }, // Like lobby codes
  commissioner: { type: String, required: true }, // Username
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
  username: { type: String, required: true },
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

// Create indexes for better query performance
leagueSchema.index({ code: 1 });
playerSchema.index({ leagueId: 1, username: 1 });
matchSchema.index({ leagueId: 1, week: 1 });
tournamentSchema.index({ leagueId: 1 });

module.exports = {
  League: mongoose.model('League', leagueSchema),
  Player: mongoose.model('Player', playerSchema),
  Match: mongoose.model('Match', matchSchema),
  Tournament: mongoose.model('Tournament', tournamentSchema)
};
