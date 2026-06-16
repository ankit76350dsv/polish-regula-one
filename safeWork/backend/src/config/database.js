const mongoose = require('mongoose');
const config = require('./environment');

// Connects to MongoDB and logs the outcome.
// Uses mongoose v8 connection events for clean lifecycle management.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongo.uri);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    // Exit immediately — the app cannot function without a database.
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected');
});

module.exports = connectDB;
