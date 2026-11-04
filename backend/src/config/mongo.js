const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

let isConnected = false;

const connectMongoDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/parksync_logs';
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000
    });
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to: ${uri}`);
    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`[MongoDB Warning] Could not connect to MongoDB at ${uri}: ${error.message}`);
    console.warn('[MongoDB Warning] ParkSync will continue running. Activity logs will be temporarily queued in memory or skipped until MongoDB is online.');
    return false;
  }
};

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[MongoDB Warning] Disconnected from MongoDB');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[MongoDB] Reconnected to MongoDB');
});

const getMongoStatus = () => isConnected;

module.exports = {
  connectMongoDB,
  getMongoStatus,
  mongoose
};

