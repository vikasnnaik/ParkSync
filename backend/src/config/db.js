const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'parksync_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
});

let isConnected = false;

// Test MySQL connectivity
const testMySQLConnection = async () => {
  try {
    const connection = await pool.getConnection();
    isConnected = true;
    console.log(`[MySQL] Connected successfully to database: ${process.env.MYSQL_DATABASE || 'parksync_db'}`);
    connection.release();
    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`[MySQL Warning] Could not connect to MySQL server: ${error.message}`);
    console.warn('[MySQL Warning] Please verify your credentials in backend/.env (MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE).');
    return false;
  }
};

const getStatus = () => isConnected;

module.exports = {
  pool,
  testMySQLConnection,
  getStatus
};

