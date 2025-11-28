const mongoose = require('mongoose');
const { League } = require('./models');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemondraft';

// Helper to generate league code
function generateLeagueCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function createTestLeague() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Generate unique code
    let code = generateLeagueCode();
    while (await League.findOne({ code })) {
      code = generateLeagueCode();
    }

    // Create new league
    const league = new League({
      name: 'NoJoinLeague',
      code: code,
      commissionerName: 'TestCommissioner',
      isPublic: true,
      maxPlayers: 8,
      splitIntoPools: false,
      numPools: 1,
      leagueWeeks: 8,
      bracketType: 'round_robin',
      format: 'National Dex',
      rules: {
        pointsLimit: 100,
        teamSize: 6,
        allowedGenerations: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        bannedPokemon: [],
        allowMega: true,
        allowGmax: true
      },
      status: 'open'
    });

    await league.save();
    console.log('✓ Successfully created NoJoinLeague');
    console.log(`  League Code: ${league.code}`);
    console.log(`  Commissioner: ${league.commissionerName}`);
    console.log(`  Status: ${league.status}`);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

createTestLeague();
