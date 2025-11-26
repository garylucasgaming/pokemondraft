const express = require('express');
const { League, Player, Match, Tournament } = require('./models');

const router = express.Router();

// Helper to generate league code
function generateLeagueCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ============ LEAGUE ROUTES ============

// Create a new league
router.post('/leagues', async (req, res) => {
  try {
    const { name, commissioner, format, rules } = req.body;
    
    let code = generateLeagueCode();
    // Ensure unique code
    while (await League.findOne({ code })) {
      code = generateLeagueCode();
    }
    
    const league = new League({
      name,
      code,
      commissioner,
      format,
      rules
    });
    
    await league.save();
    res.json({ ok: true, league });
  } catch (err) {
    console.error('Error creating league:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get league by code
router.get('/leagues/:code', async (req, res) => {
  try {
    const league = await League.findOne({ code: req.params.code });
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    res.json({ ok: true, league });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get all leagues (for browsing)
router.get('/leagues', async (req, res) => {
  try {
    const leagues = await League.find().sort({ createdAt: -1 }).limit(50);
    res.json({ ok: true, leagues });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update league
router.put('/leagues/:code', async (req, res) => {
  try {
    const { commissioner, ...updates } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    // Only commissioner can update
    if (league.commissioner !== commissioner) {
      return res.status(403).json({ ok: false, error: 'Only commissioner can update league' });
    }
    
    Object.assign(league, updates);
    await league.save();
    res.json({ ok: true, league });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============ PLAYER ROUTES ============

// Join a league
router.post('/leagues/:code/players', async (req, res) => {
  try {
    const { username, team } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    // Check if player already joined
    const existing = await Player.findOne({ leagueId: league._id, username });
    if (existing) {
      return res.status(400).json({ ok: false, error: 'Already joined this league' });
    }
    
    // Validate team against league rules
    const totalPoints = team.reduce((sum, p) => sum + (p.points || 0), 0);
    if (totalPoints > league.rules.pointsLimit) {
      return res.status(400).json({ ok: false, error: `Team exceeds points limit (${totalPoints}/${league.rules.pointsLimit})` });
    }
    
    if (team.length > league.rules.teamSize) {
      return res.status(400).json({ ok: false, error: `Team exceeds size limit (${team.length}/${league.rules.teamSize})` });
    }
    
    const player = new Player({
      username,
      leagueId: league._id,
      team,
      totalPoints
    });
    
    await player.save();
    res.json({ ok: true, player });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get all players in a league
router.get('/leagues/:code/players', async (req, res) => {
  try {
    const league = await League.findOne({ code: req.params.code });
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    const players = await Player.find({ leagueId: league._id })
      .sort({ wins: -1, losses: 1 });
    
    res.json({ ok: true, players });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============ MATCH ROUTES ============

// Create a match
router.post('/leagues/:code/matches', async (req, res) => {
  try {
    const { player1Id, player2Id, week, round, tournamentId } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    const match = new Match({
      leagueId: league._id,
      player1: player1Id,
      player2: player2Id,
      week,
      round,
      tournamentId
    });
    
    await match.save();
    res.json({ ok: true, match });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Report match result
router.put('/matches/:matchId/result', async (req, res) => {
  try {
    const { winnerId, score, replayUrl, notes } = req.body;
    const match = await Match.findById(req.params.matchId);
    
    if (!match) {
      return res.status(404).json({ ok: false, error: 'Match not found' });
    }
    
    match.winner = winnerId;
    match.score = score;
    match.replayUrl = replayUrl;
    match.notes = notes;
    match.status = 'completed';
    match.playedAt = new Date();
    
    await match.save();
    
    // Update player records
    const winner = await Player.findById(winnerId);
    const loserId = match.player1.equals(winnerId) ? match.player2 : match.player1;
    const loser = await Player.findById(loserId);
    
    if (winner) {
      winner.wins += 1;
      await winner.save();
    }
    
    if (loser) {
      loser.losses += 1;
      await loser.save();
    }
    
    res.json({ ok: true, match });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get matches for a league
router.get('/leagues/:code/matches', async (req, res) => {
  try {
    const league = await League.findOne({ code: req.params.code });
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    const matches = await Match.find({ leagueId: league._id })
      .populate('player1 player2 winner')
      .sort({ createdAt: -1 });
    
    res.json({ ok: true, matches });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============ TOURNAMENT ROUTES ============

// Create a tournament
router.post('/leagues/:code/tournaments', async (req, res) => {
  try {
    const { name, format, participantIds } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    const tournament = new Tournament({
      leagueId: league._id,
      name,
      format,
      participants: participantIds
    });
    
    await tournament.save();
    res.json({ ok: true, tournament });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get tournaments for a league
router.get('/leagues/:code/tournaments', async (req, res) => {
  try {
    const league = await League.findOne({ code: req.params.code });
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    const tournaments = await Tournament.find({ leagueId: league._id })
      .populate('participants winner')
      .sort({ createdAt: -1 });
    
    res.json({ ok: true, tournaments });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
