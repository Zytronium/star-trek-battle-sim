// Reset database script - drops all tables and recreates the new schema

const { pool } = require('../config/database');

async function resetDatabase() {
  console.log('\nRESETTING DATABASE');
  console.log('----------------------------')
  
  try {
    // drop all existing tables
    await pool.query('DROP SCHEMA public CASCADE;');
    await pool.query('CREATE SCHEMA public;');
    console.log('Dropped all existing tables and recreated schema');
    
    // recreate tables with the new schema
    const { createDatabase } = require('./create_db_new.js');
    await createDatabase();
    
    console.log('----------------------------');
    console.log('DATABASE RESET COMPLETE!');
    console.log('All tables have been dropped and recreated with the new schema.');
    console.log('Your database is now clean and ready for development.');
    console.log('----------------------------');

  } catch (error) {
    console.error('Error resetting database:', error.message);
    throw error;
  } finally {
    // Clean up and close out
    await pool.end();
  }
}

// Only run if called directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('\nDatabase reset completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database reset failed:', error);
      process.exit(1);
    });
}

module.exports = { resetDatabase };
