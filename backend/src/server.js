const path = require('path');
const dotenv = require('dotenv');

// Load environment variables before requiring any modules
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const { testMySQLConnection } = require('./config/db');
const { connectMongoDB } = require('./config/mongo');

const PORT = parseInt(process.env.PORT || '5000', 10);

const startServer = async () => {
  console.log('========================================================');
  console.log('  ParkSync: Intelligent Parking Management System Backend');
  console.log('========================================================');

  // Test and initialize connections
  const mysqlConnected = await testMySQLConnection();
  const mongoConnected = await connectMongoDB();

  const server = app.listen(PORT, () => {
    console.log(`[ParkSync Server] Running on http://localhost:${PORT}`);
    console.log(`[Health Endpoint] http://localhost:${PORT}/api/health`);
    console.log(`[Database Status] MySQL: ${mysqlConnected ? 'ONLINE' : 'OFFLINE (Check .env credentials)'} | MongoDB: ${mongoConnected ? 'ONLINE' : 'OFFLINE'}`);
  });

  const shutdown = async () => {
    console.log('\n[ParkSync Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[ParkSync Server] Closed active connections.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startServer();

