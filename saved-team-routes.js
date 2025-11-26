const express = require('express');
const router = express.Router();
const { SavedTeam } = require('./models');

// Generate unique share code
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new saved team
router.post('/teams', async (req, res) => {
  try {
    const { userId, username, name, pokemon, format, description, isPublic, teamBuilderData } = req.body;

    if (!name || !pokemon || !Array.isArray(pokemon) || pokemon.length === 0) {
      return res.status(400).json({ error: 'Name and pokemon array are required' });
    }

    // Validate pokemon structure
    for (const p of pokemon) {
      if (!p.name) {
        return res.status(400).json({ error: 'Each pokemon must have a name' });
      }
    }

    const team = new SavedTeam({
      userId,
      username,
      name,
      pokemon,
      format,
      description,
      isPublic: isPublic || false,
      teamBuilderData
    });

    await team.save();
    res.status(201).json({ success: true, team });
  } catch (error) {
    console.error('Error creating saved team:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get a saved team by ID
router.get('/teams/:id', async (req, res) => {
  try {
    const team = await SavedTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json({ success: true, team });
  } catch (error) {
    console.error('Error fetching saved team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Get a saved team by share code
router.get('/teams/share/:code', async (req, res) => {
  try {
    const team = await SavedTeam.findOne({ shareCode: req.params.code.toUpperCase() });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (!team.isPublic) {
      return res.status(403).json({ error: 'Team is private' });
    }
    res.json({ success: true, team });
  } catch (error) {
    console.error('Error fetching shared team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// List saved teams for a user
router.get('/teams', async (req, res) => {
  try {
    const { userId, username } = req.query;
    
    const query = {};
    if (userId) query.userId = userId;
    if (username) query.username = username;

    const teams = await SavedTeam.find(query)
      .sort({ updatedAt: -1 })
      .limit(100);
    
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Error listing saved teams:', error);
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

// Browse public teams
router.get('/teams/public/browse', async (req, res) => {
  try {
    const { format, limit = 20 } = req.query;
    
    const query = { isPublic: true };
    if (format) query.format = format;

    const teams = await SavedTeam.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('-userId'); // Don't expose user IDs for public teams
    
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Error browsing public teams:', error);
    res.status(500).json({ error: 'Failed to browse teams' });
  }
});

// Update a saved team
router.put('/teams/:id', async (req, res) => {
  try {
    const { userId, name, pokemon, format, description, isPublic } = req.body;

    const team = await SavedTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Authorization check: user can only update their own teams
    if (userId && team.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this team' });
    }

    // Update fields
    if (name) team.name = name;
    if (pokemon) {
      // Validate pokemon structure
      for (const p of pokemon) {
        if (!p.name) {
          return res.status(400).json({ error: 'Each pokemon must have a name' });
        }
      }
      team.pokemon = pokemon;
    }
    if (format !== undefined) team.format = format;
    if (description !== undefined) team.description = description;
    
    // Handle publicity change
    if (isPublic !== undefined) {
      if (isPublic && !team.isPublic && !team.shareCode) {
        // Generate share code when making public
        let attempts = 0;
        while (attempts < 10) {
          const code = generateShareCode();
          const existing = await SavedTeam.findOne({ shareCode: code });
          if (!existing) {
            team.shareCode = code;
            break;
          }
          attempts++;
        }
        if (attempts >= 10) {
          return res.status(500).json({ error: 'Failed to generate unique share code' });
        }
      }
      team.isPublic = isPublic;
    }

    team.updatedAt = new Date();
    await team.save();

    res.json({ success: true, team });
  } catch (error) {
    console.error('Error updating saved team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete a saved team
router.delete('/teams/:id', async (req, res) => {
  try {
    const { userId } = req.query;

    const team = await SavedTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Authorization check: user can only delete their own teams
    if (userId && team.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this team' });
    }

    await SavedTeam.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Team deleted' });
  } catch (error) {
    console.error('Error deleting saved team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Export team to Showdown format
router.get('/teams/:id/export', async (req, res) => {
  try {
    const team = await SavedTeam.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Generate Showdown paste format
    let showdownText = '';
    for (const p of team.pokemon) {
      showdownText += `${p.name}`;
      if (p.gender) showdownText += ` (${p.gender})`;
      if (p.item) showdownText += ` @ ${p.item}`;
      showdownText += '\n';
      
      if (p.ability) showdownText += `Ability: ${p.ability}\n`;
      if (p.level && p.level !== 50) showdownText += `Level: ${p.level}\n`;
      if (p.shiny) showdownText += `Shiny: Yes\n`;
      if (p.teraType) showdownText += `Tera Type: ${p.teraType}\n`;
      
      // EVs
      const evs = [];
      if (p.evs) {
        if (p.evs.hp > 0) evs.push(`${p.evs.hp} HP`);
        if (p.evs.attack > 0) evs.push(`${p.evs.attack} Atk`);
        if (p.evs.defense > 0) evs.push(`${p.evs.defense} Def`);
        if (p.evs.specialAttack > 0) evs.push(`${p.evs.specialAttack} SpA`);
        if (p.evs.specialDefense > 0) evs.push(`${p.evs.specialDefense} SpD`);
        if (p.evs.speed > 0) evs.push(`${p.evs.speed} Spe`);
      }
      if (evs.length > 0) showdownText += `EVs: ${evs.join(' / ')}\n`;
      
      if (p.nature) showdownText += `${p.nature} Nature\n`;
      
      // IVs (only show if not 31)
      const ivs = [];
      if (p.ivs) {
        if (p.ivs.hp !== 31) ivs.push(`${p.ivs.hp} HP`);
        if (p.ivs.attack !== 31) ivs.push(`${p.ivs.attack} Atk`);
        if (p.ivs.defense !== 31) ivs.push(`${p.ivs.defense} Def`);
        if (p.ivs.specialAttack !== 31) ivs.push(`${p.ivs.specialAttack} SpA`);
        if (p.ivs.specialDefense !== 31) ivs.push(`${p.ivs.specialDefense} SpD`);
        if (p.ivs.speed !== 31) ivs.push(`${p.ivs.speed} Spe`);
      }
      if (ivs.length > 0) showdownText += `IVs: ${ivs.join(' / ')}\n`;
      
      // Moves
      if (p.moves && p.moves.length > 0) {
        for (const move of p.moves) {
          if (move) showdownText += `- ${move}\n`;
        }
      }
      
      showdownText += '\n';
    }

    res.json({ success: true, showdownText: showdownText.trim() });
  } catch (error) {
    console.error('Error exporting team:', error);
    res.status(500).json({ error: 'Failed to export team' });
  }
});

module.exports = router;
