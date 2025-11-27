const mongoose = require('mongoose');
const { League, Player } = require('./models');
require('dotenv').config();

// MongoDB connection
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemondraft';

// Fake player names
const testPlayers = [
  'AshKetchum',
  'MistyWaterflower',
  'BrockHarrison',
  'GaryOak',
  'ProfessorElm',
  'LanceDragon',
  'CynthiaChampion',
];

async function addTestPlayers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Get the league code from command line argument
    const leagueCode = process.argv[2];
    
    if (!leagueCode) {
      console.error('Usage: node add-test-players.js <LEAGUE_CODE>');
      console.error('Example: node add-test-players.js ABC123');
      process.exit(1);
    }

    // Find the league
    const league = await League.findOne({ code: leagueCode.toUpperCase() });
    
    if (!league) {
      console.error(`League with code ${leagueCode} not found`);
      process.exit(1);
    }

    console.log(`Found league: ${league.name}`);
    console.log(`Adding ${testPlayers.length} test players...`);

    let added = 0;
    let skipped = 0;

    for (const username of testPlayers) {
      // Check if player already exists
      const existing = await Player.findOne({ 
        leagueId: league._id, 
        username 
      });

      if (existing) {
        console.log(`  ⏭️  ${username} - already exists, skipping`);
        skipped++;
        continue;
      }

      // Create new player with empty team
      const player = new Player({
        username,
        leagueId: league._id,
        team: [],
        totalPoints: 0,
        wins: 0,
        losses: 0,
        standing: 0
      });

      await player.save();
      console.log(`  ✅ ${username} - added successfully`);
      added++;
    }

    console.log('\n✨ Complete!');
    console.log(`   Added: ${added} players`);
    console.log(`   Skipped: ${skipped} players (already existed)`);
    console.log(`   Total players in league: ${added + skipped}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

addTestPlayers();
