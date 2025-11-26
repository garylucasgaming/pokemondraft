const mongoose = require('mongoose');
require('dotenv').config();

async function fixShareCodeIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('savedteams');

    // Drop the shareCode index
    console.log('Dropping shareCode index...');
    try {
      await collection.dropIndex('shareCode_1');
      console.log('✓ shareCode index dropped');
    } catch (error) {
      console.log('Index may not exist:', error.message);
    }

    // Add compound index for username queries (for fast team retrieval)
    console.log('Creating compound index on username + createdAt...');
    await collection.createIndex({ username: 1, createdAt: -1 });
    console.log('✓ Compound index created');

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    console.log('\n✓ Fix complete! You can now save multiple teams.');
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixShareCodeIndex();
