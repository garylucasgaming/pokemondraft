require('dotenv').config();
const mongoose = require('mongoose');
const { League, Player } = require('./models');

const MONGO_URI = process.env.MONGODB_URI;

async function listLeagues() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    const leagues = await League.find().sort({ createdAt: -1 }).limit(10);
    
    if (leagues.length === 0) {
      console.log('No leagues found in database.');
      return;
    }

    console.log(`Found ${leagues.length} league(s):\n`);
    
    for (const league of leagues) {
      const playerCount = await Player.countDocuments({ leagueId: league._id });
      console.log(`📋 ${league.name}`);
      console.log(`   Code: ${league.code}`);
      console.log(`   Commissioner: ${league.commissionerName}`);
      console.log(`   Players: ${playerCount}`);
      console.log(`   Status: ${league.status}`);
      console.log(`   Bracket Type: ${league.bracketType}`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

listLeagues();
