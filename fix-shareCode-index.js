require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function fixShareCodeIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('savedteams');

    console.log('Dropping old shareCode index...');
    try {
      await collection.dropIndex('shareCode_1');
      console.log('Old index dropped');
    } catch (err) {
      console.log('Index may not exist, continuing...');
    }

    console.log('Creating new sparse unique index on shareCode...');
    await collection.createIndex(
      { shareCode: 1 },
      { unique: true, sparse: true }
    );
    console.log('New sparse index created successfully!');

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing index:', error);
    process.exit(1);
  }
}

fixShareCodeIndex();
