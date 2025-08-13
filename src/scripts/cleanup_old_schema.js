// Script to clean up old database schema before creating new one
const { pool } = require('../config/database');

async function cleanupOldSchema() {
  console.log('\nCLEANING UP OLD DATABASE SCHEMA');
  console.log('----------------------------')

  try {
    // Drop tables in reverse dependency order
    console.log('Dropping old tables...');
    
    // Drop junction tables first (they reference other tables)
    await pool.query('DROP TABLE IF EXISTS ship_defenses CASCADE;');
    await pool.query('DROP TABLE IF EXISTS ship_weapons CASCADE;');
    console.log('Dropped junction tables');
    
    // Drop main tables
    await pool.query('DROP TABLE IF EXISTS weapons CASCADE;');
    await pool.query('DROP TABLE IF EXISTS defenses CASCADE;');
    await pool.query('DROP TABLE IF EXISTS ships CASCADE;');
    await pool.query('DROP TABLE IF EXISTS boss_ships CASCADE;');
    await pool.query('DROP TABLE IF EXISTS special_effects CASCADE;');
    await pool.query('DROP TABLE IF EXISTS spacecrafts CASCADE;');
    console.log('Dropped main tables');
    
    console.log('\nOld schema cleanup completed successfully!');
    console.log('All old tables have been removed.');
    console.log('You can now run: npm run create-db-new');

  } catch (error) {
    console.error('Error cleaning up old schema:', error.message);
    throw error;
  }
}

// Only run if called directly
if (require.main === module) {
  cleanupOldSchema()
    .then(() => {
      console.log('\nCleanup completed successfully!');
      return pool.end();
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldSchema };
