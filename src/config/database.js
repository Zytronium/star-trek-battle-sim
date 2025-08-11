const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ quiet: true });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

async function createTables() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '/database/sql/createtable.sql'), 
      'utf8'
    );
    await client.query(sql);
    console.log('✅ Database tables created');
  } catch (err) {
    console.error('❌ Table creation failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function verifyConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return false;
  }
}

module.exports = { 
  pool,
  verifyConnection,
  createTables
};