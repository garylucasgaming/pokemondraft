const mongoose = require('mongoose');
require('dotenv').config();

async function verifyAndFixIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('savedteams');

    // Get all indexes
    console.log('\n=== Current Indexes ===');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Check if shareCode index exists and is sparse
    const shareCodeIndex = indexes.find(idx => idx.name === 'shareCode_1');
    if (shareCodeIndex) {
      console.log('\n=== shareCode_1 Index Details ===');
      console.log('Sparse:', shareCodeIndex.sparse || false);
      console.log('Unique:', shareCodeIndex.unique || false);
    }

    // Count documents with null shareCode
    const nullCount = await collection.countDocuments({ shareCode: null });
    console.log('\n=== Documents with null shareCode ===');
    console.log('Count:', nullCount);

    // Option 1: Drop the entire collection and let Mongoose recreate it
    console.log('\n=== Dropping savedteams collection entirely ===');
    await collection.drop();
    console.log('✓ Collection dropped successfully');
    console.log('Mongoose will recreate it with correct schema on next save');

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    console.log('\n✓ Fix complete! Restart socket-server.js and try saving again.');
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

verifyAndFixIndex();
