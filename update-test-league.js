const mongoose = require('mongoose');
const { League } = require('./models');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemondraft';

async function updateTestLeague() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Find Test League by code BD9UK7
    const league = await League.findOne({ code: 'BD9UK7' });
    
    if (!league) {
      console.log('✗ Test League (BD9UK7) not found');
      return;
    }

    console.log(`Found league: ${league.name} (${league.code})`);
    console.log(`Current commissioner: ${league.commissionerName || league.commissioner || 'NONE'}`);

    // Update with same settings as NoJoinLeague (set commissioner if missing)
    if (!league.commissionerName) {
      league.commissionerName = 'hikergary';
    }
    league.maxPlayers = 8;
    league.splitIntoPools = false;
    league.numPools = 1;
    league.leagueWeeks = 8;
    league.bracketType = 'round_robin';
    league.format = 'National Dex';
    league.rules = {
      pointsLimit: 100,
      teamSize: 6,
      allowedGenerations: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      bannedPokemon: [],
      allowMega: true,
      allowGmax: true
    };
    league.status = 'open';

    await league.save();
    console.log('✓ Successfully updated Test League');
    console.log(`  League Code: ${league.code}`);
    console.log(`  Commissioner: ${league.commissionerName}`);
    console.log(`  Status: ${league.status}`);
    console.log(`  Max Players: ${league.maxPlayers}`);
    console.log(`  Weeks: ${league.leagueWeeks}`);
    console.log(`  Bracket Type: ${league.bracketType}`);
    console.log(`  Format: ${league.format}`);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

updateTestLeague();
