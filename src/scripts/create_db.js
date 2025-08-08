// this is the file to setup the database with tables

const { pool } = require('../config/database');

async function createDatabase() {
  console.log('creating database');

  try {
	// create the spacecrafts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spacecrafts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        class VARCHAR(255),
        affiliation VARCHAR(255),
        registry VARCHAR(255),
        status VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('created table spacecrafts');

    // create the weapons table
	// linked to spacecraft through spacecrafts(id)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weapons (
        id SERIAL PRIMARY KEY,
        spacecraft_id INTEGER REFERENCES spacecrafts(id) ON DELETE CASCADE,
        weapon_type VARCHAR(255),
        weapon_name VARCHAR(255),
        description TEXT,
        affiliation VARCHAR(255),
        era VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('created table weapons');

	// logs for what was created
    console.log('database created \n');
    console.log('the tables created...');
    console.log('spacecrafts (id, name, class, affiliation, registry, status, description)');
    console.log('weapons (id, spacecraft_id, weapon_type, weapon_name, description, affiliation, era)');

  } catch (error) {
    console.error('error creating database', error.message);
    throw error;
  }
}

// this is just a safety check, will only create db if run on command line
// if another file requires this one it wont create db again
if (require.main === module) {
  createDatabase()
    .then(() => {
      console.log('closing database');
      return pool.end();
    })
    .catch(console.error);
}

module.exports = { createDatabase };
