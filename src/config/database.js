// this is the database file

const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

// use env variables or default
// I added a 3rd user option, I was having trouble connecting on mac
const pool = new Pool({
  user: process.env.DB_USER || process.env.USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'star_trek_db',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});


// testing connections
pool.on('connect', () => {
  console.log('connected to db');
});

pool.on('error', (err) => {
  console.error('error connecting to db', err);
});

module.exports = { pool };
