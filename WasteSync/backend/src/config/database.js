const mongoose = require('mongoose');
const config = require('./environment');

// Connects to MongoDB once when the app starts.
// If the database is unreachable we stop the whole app, because WasteSync
// cannot store a single report or audit log without it.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongo.uri);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// If the database drops out while the app is running, write a warning so we can
// see it in the logs (mongoose will try to reconnect automatically).
mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected');
});

module.exports = connectDB;
