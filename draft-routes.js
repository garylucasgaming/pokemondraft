const express = require('express');
const router = express.Router();
const { DraftSession, User } = require('./models');
const { authenticateToken } = require('./auth-routes');

// Save or update draft session (called when lobby created, settings changed, or draft progresses)
router.post('/drafts/save', async (req, res) => {
  try {
    const { 
      lobbyCode, 
      hostSocketId, 
      status, 
      settings, 
      participants, 
      turnOrder, 
      currentTurn,
      draftPokemon,
      pointsMap,
      banList,
      presetUsed 
    } = req.body;

    if (!lobbyCode) {
      return res.status(400).json({ error: 'Lobby code required' });
    }

    // Find existing session or create new
    let session = await DraftSession.findOne({ lobbyCode });

    if (session) {
      // Update existing
      if (hostSocketId) session.hostSocketId = hostSocketId;
      if (status) session.status = status;
      if (settings) session.settings = settings;
      if (participants) session.participants = participants;
      if (turnOrder) session.turnOrder = turnOrder;
      if (currentTurn !== undefined) session.currentTurn = currentTurn;
      if (draftPokemon) session.draftPokemon = draftPokemon;
      if (pointsMap) session.pointsMap = pointsMap;
      if (banList) session.banList = banList;
      if (presetUsed) session.presetUsed = presetUsed;
      
      session.updatedAt = new Date();
      
      if (status === 'drafting' && !session.startedAt) {
        session.startedAt = new Date();
      }
      if (status === 'completed' && !session.completedAt) {
        session.completedAt = new Date();
      }
    } else {
      // Create new
      session = new DraftSession({
        lobbyCode,
        hostSocketId,
        status: status || 'lobby',
        settings: settings || {},
        participants: participants || [],
        turnOrder: turnOrder || [],
        currentTurn,
        draftPokemon: draftPokemon || [],
        pointsMap: pointsMap || {},
        banList: banList || [],
        presetUsed
      });
    }

    await session.save();

    res.json({
      success: true,
      message: 'Draft session saved',
      session: {
        lobbyCode: session.lobbyCode,
        status: session.status,
        updatedAt: session.updatedAt
      }
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Failed to save draft session' });
  }
});

// Get draft session by lobby code
router.get('/drafts/:lobbyCode', async (req, res) => {
  try {
    const session = await DraftSession.findOne({ lobbyCode: req.params.lobbyCode });

    if (!session) {
      return res.status(404).json({ error: 'Draft session not found' });
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Draft session expired' });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({ error: 'Failed to fetch draft session' });
  }
});

// Get ongoing drafts for a user (authenticated)
router.get('/drafts/user/ongoing', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const sessions = await DraftSession.find({
      'participants.userId': userId,
      status: { $in: ['lobby', 'drafting'] },
      expiresAt: { $gt: new Date() }
    }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      sessions: sessions.map(s => ({
        lobbyCode: s.lobbyCode,
        status: s.status,
        participantCount: s.participants.length,
        settings: s.settings,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        mySelections: s.participants.find(p => p.userId?.toString() === userId)?.selections || []
      }))
    });
  } catch (error) {
    console.error('Get user drafts error:', error);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Get ongoing drafts by username (for non-authenticated users using localStorage)
router.get('/drafts/username/:username', async (req, res) => {
  try {
    const username = req.params.username;

    const sessions = await DraftSession.find({
      'participants.username': username,
      status: { $in: ['lobby', 'drafting'] },
      expiresAt: { $gt: new Date() }
    }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      sessions: sessions.map(s => ({
        lobbyCode: s.lobbyCode,
        status: s.status,
        participantCount: s.participants.length,
        settings: s.settings,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        mySelections: s.participants.find(p => p.username === username)?.selections || []
      }))
    });
  } catch (error) {
    console.error('Get drafts by username error:', error);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Update participant connection status
router.post('/drafts/:lobbyCode/participant/:username/connect', async (req, res) => {
  try {
    const { lobbyCode, username } = req.params;
    const { socketId, isConnected } = req.body;

    const session = await DraftSession.findOne({ lobbyCode });
    if (!session) {
      return res.status(404).json({ error: 'Draft session not found' });
    }

    const participant = session.participants.find(p => p.username === username);
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    if (socketId) participant.socketId = socketId;
    if (isConnected !== undefined) participant.isConnected = isConnected;
    participant.lastSeen = new Date();

    await session.save();

    res.json({
      success: true,
      message: 'Participant status updated'
    });
  } catch (error) {
    console.error('Update participant error:', error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// Mark draft as completed
router.post('/drafts/:lobbyCode/complete', async (req, res) => {
  try {
    const session = await DraftSession.findOne({ lobbyCode: req.params.lobbyCode });
    if (!session) {
      return res.status(404).json({ error: 'Draft session not found' });
    }

    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();

    res.json({
      success: true,
      message: 'Draft marked as completed'
    });
  } catch (error) {
    console.error('Complete draft error:', error);
    res.status(500).json({ error: 'Failed to complete draft' });
  }
});

// Delete/abandon draft session
router.delete('/drafts/:lobbyCode', async (req, res) => {
  try {
    const session = await DraftSession.findOneAndDelete({ lobbyCode: req.params.lobbyCode });
    
    if (!session) {
      return res.status(404).json({ error: 'Draft session not found' });
    }

    res.json({
      success: true,
      message: 'Draft session deleted'
    });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

// Get draft history for authenticated user
router.get('/drafts/user/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 20;

    const sessions = await DraftSession.find({
      'participants.userId': userId,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .limit(limit);

    res.json({
      success: true,
      history: sessions.map(s => ({
        lobbyCode: s.lobbyCode,
        participantCount: s.participants.length,
        settings: s.settings,
        myTeam: s.participants.find(p => p.userId?.toString() === userId)?.selections || [],
        completedAt: s.completedAt,
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    console.error('Get draft history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Cleanup expired drafts (called periodically or manually)
router.post('/drafts/cleanup', async (req, res) => {
  try {
    const result = await DraftSession.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

module.exports = router;
