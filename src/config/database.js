const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD || null, // Ensure this is always a string or null
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  max: 10
});

async function verifyConnection(retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (err) {
      if (i === retries - 1) {
        console.error('❌ Database connection failed after retries:', err.message);
        return false;
      }
      console.log(`⌛ Connection failed (attempt ${i+1}/${retries}), retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

module.exports = { 
  pool,
  verifyConnection
};