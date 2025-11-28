const mongoose = require('mongoose');
const { League, Player } = require('./models');

// MongoDB connection string - use your Atlas connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemondraft';

async function addPlayerToLeague() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    const leagueCode = 'BD9UK7';
    const username = 'hikergary'; // lowercase to match schema

    // Verify league exists
    const league = await League.findOne({ code: leagueCode });
    
    if (!league) {
      console.log(`✗ League with code "${leagueCode}" not found`);
      process.exit(1);
    }

    console.log(`✓ Found league: ${league.name} (Code: ${league.code})`);

    // Check if player already exists
    const existingPlayer = await Player.findOne({
      leagueCode: leagueCode,
      username: username
    });

    if (existingPlayer) {
      console.log(`✓ Player "${username}" is already in this league`);
      process.exit(0);
    }

    // Create new player
    const player = new Player({
      leagueId: league._id,
      leagueCode: leagueCode,
      username: username,
      wins: 0,
      losses: 0,
      teamSubmitted: false
    });

    await player.save();
    console.log(`✓ Successfully added ${username} to ${league.name}`);
    console.log(`  League Code: ${league.code}`);
    console.log(`  Player ID: ${player._id}`);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

addPlayerToLeague();
