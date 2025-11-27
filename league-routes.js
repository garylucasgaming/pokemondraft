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
    const { 
      name, 
      commissioner, 
      isPublic, 
      maxPlayers, 
      splitIntoPools, 
      numPools, 
      leagueWeeks, 
      bracketType,
      format, 
      rules 
    } = req.body;
    
    let code = generateLeagueCode();
    // Ensure unique code
    while (await League.findOne({ code })) {
      code = generateLeagueCode();
    }
    
    const league = new League({
      name,
      code,
      commissionerName: commissioner,
      isPublic: isPublic !== undefined ? isPublic : true,
      maxPlayers: maxPlayers || 8,
      splitIntoPools: splitIntoPools || false,
      numPools: numPools || 1,
      leagueWeeks: leagueWeeks || 8,
      bracketType: bracketType || 'round_robin',
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
    
    // Clean up expired invite codes
    if (league.inviteCodes && league.inviteCodes.length > 0) {
      const now = new Date();
      const validCodes = league.inviteCodes.filter(inv => new Date(inv.expiresAt) > now);
      if (validCodes.length !== league.inviteCodes.length) {
        league.inviteCodes = validCodes;
        await league.save();
      }
    }
    
    res.json({ ok: true, league });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Request to join a league (adds to pending list)
router.post('/leagues/:code/request', async (req, res) => {
  try {
    const { username } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    if (!league.isPublic) {
      return res.status(403).json({ ok: false, error: 'This league is private' });
    }
    
    // Check if user is already a player
    const existingPlayer = await Player.findOne({ 
      leagueId: league._id, 
      username: username 
    });
    
    if (existingPlayer) {
      return res.status(400).json({ ok: false, error: 'You are already a member of this league' });
    }
    
    // Check if user already has a pending request
    if (!league.pendingPlayers) {
      league.pendingPlayers = [];
    }
    
    if (league.pendingPlayers.includes(username)) {
      return res.status(400).json({ ok: false, error: 'You already have a pending request for this league' });
    }
    
    // Add to pending players
    league.pendingPlayers.push(username);
    await league.save();
    
    res.json({ 
      ok: true,
      message: 'Join request sent successfully',
      league 
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generate invite code for a league (commissioner only)
router.post('/leagues/:code/invite', async (req, res) => {
  try {
    const { commissionerName } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    // Only commissioner can generate invite codes
    if (league.commissionerName !== commissionerName) {
      return res.status(403).json({ ok: false, error: 'Only commissioner can generate invite codes' });
    }
    
    // Generate unique 8-character invite code
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let inviteCode = '';
    for (let i = 0; i < 8; i++) {
      inviteCode += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Set expiry to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Initialize inviteCodes array if it doesn't exist
    if (!league.inviteCodes) {
      league.inviteCodes = [];
    }
    
    // Add new invite code
    league.inviteCodes.push({
      code: inviteCode,
      createdAt: new Date(),
      expiresAt: expiresAt
    });
    
    await league.save();
    
    res.json({ 
      ok: true,
      inviteCode,
      expiresAt,
      message: 'Invite code generated successfully'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Join league using invite code
router.post('/leagues/invite/:inviteCode/join', async (req, res) => {
  try {
    const { username } = req.body;
    const inviteCode = req.params.inviteCode;
    
    // Find league with this invite code
    const league = await League.findOne({ 
      'inviteCodes.code': inviteCode 
    });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'Invalid invite code' });
    }
    
    // Find the specific invite code
    const invite = league.inviteCodes.find(inv => inv.code === inviteCode);
    
    if (!invite) {
      return res.status(404).json({ ok: false, error: 'Invalid invite code' });
    }
    
    // Check if expired
    if (new Date() > new Date(invite.expiresAt)) {
      // Remove expired invite
      league.inviteCodes = league.inviteCodes.filter(inv => inv.code !== inviteCode);
      await league.save();
      return res.status(400).json({ ok: false, error: 'Invite code has expired' });
    }
    
    // Check if user is already a player
    const existingPlayer = await Player.findOne({ 
      leagueId: league._id, 
      username: username 
    });
    
    if (existingPlayer) {
      return res.status(400).json({ ok: false, error: 'You are already a member of this league' });
    }
    
    // Create player with empty team
    const player = new Player({
      username,
      leagueId: league._id,
      team: [],
      totalPoints: 0
    });
    
    await player.save();
    
    // Remove the used invite code
    league.inviteCodes = league.inviteCodes.filter(inv => inv.code !== inviteCode);
    await league.save();
    
    res.json({ 
      ok: true, 
      message: 'Successfully joined league',
      player,
      league
    });
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

// Update league schedule
router.put('/leagues/:code/schedule', async (req, res) => {
  try {
    const { commissioner, schedule } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    // Only commissioner can update schedule
    if (league.commissionerName !== commissioner) {
      console.log('Schedule update rejected:', { 
        leagueCommissioner: league.commissionerName, 
        requestCommissioner: commissioner 
      });
      return res.status(403).json({ 
        ok: false, 
        error: `Only commissioner can update schedule. League commissioner: ${league.commissionerName}, Request from: ${commissioner}` 
      });
    }
    
    league.schedule = schedule;
    await league.save();
    res.json({ ok: true, schedule: league.schedule });
  } catch (err) {
    console.error('Schedule update error:', err);
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

// Accept a player request (commissioner only)
router.post('/leagues/:code/players/accept', async (req, res) => {
  try {
    const { username, commissionerName } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    // Only commissioner can accept players
    if (league.commissionerName !== commissionerName) {
      return res.status(403).json({ ok: false, error: 'Only commissioner can accept players' });
    }
    
    // Check if user is in pending list
    if (!league.pendingPlayers || !league.pendingPlayers.includes(username)) {
      return res.status(400).json({ ok: false, error: 'No pending request from this player' });
    }
    
    // Check if already a player
    const existingPlayer = await Player.findOne({ 
      leagueId: league._id, 
      username: username 
    });
    
    if (existingPlayer) {
      // Remove from pending and return
      league.pendingPlayers = league.pendingPlayers.filter(p => p !== username);
      await league.save();
      return res.status(400).json({ ok: false, error: 'Player is already a member' });
    }
    
    // Create player with empty team
    const player = new Player({
      username,
      leagueId: league._id,
      team: [],
      totalPoints: 0
    });
    
    await player.save();
    
    // Remove from pending list
    league.pendingPlayers = league.pendingPlayers.filter(p => p !== username);
    await league.save();
    
    res.json({ ok: true, message: 'Player accepted', player, league });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Kick a player (commissioner only)
router.post('/leagues/:code/players/kick', async (req, res) => {
  try {
    const { username, commissionerName } = req.body;
    const league = await League.findOne({ code: req.params.code });
    
    if (!league) {
      return res.status(404).json({ ok: false, error: 'League not found' });
    }
    
    // Only commissioner can kick players
    if (league.commissionerName !== commissionerName) {
      return res.status(403).json({ ok: false, error: 'Only commissioner can kick players' });
    }
    
    // Can't kick the commissioner
    if (username === commissionerName) {
      return res.status(400).json({ ok: false, error: 'Cannot kick the commissioner' });
    }
    
    // Find and delete the player
    const player = await Player.findOne({ 
      leagueId: league._id, 
      username: username 
    });
    
    if (!player) {
      return res.status(404).json({ ok: false, error: 'Player not found in this league' });
    }
    
    await Player.deleteOne({ _id: player._id });
    
    res.json({ ok: true, message: 'Player removed from league' });
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
