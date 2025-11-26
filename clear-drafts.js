require('dotenv').config();
const mongoose = require('mongoose');
const { DraftSession } = require('./models');

const MONGODB_URI = process.env.MONGODB_URI;

async function clearAllDrafts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Deleting all draft sessions...');
    const result = await DraftSession.deleteMany({});
    console.log(`Successfully deleted ${result.deletedCount} draft session(s)`);

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing drafts:', error);
    process.exit(1);
  }
}

clearAllDrafts();
