// this file just resets the database back to empty
// and then calls create db to start off fresh

const { pool } = require('../config/database');

async function resetDatabase() {
  console.log('\nRE-SETTING DB');
  console.log(' !----------------------------!')
  
  try {
    // drop tables if already existing
	// only need to do spacecrafts and cascade since weapons depend on spacecrafts
    await pool.query('DROP TABLE IF EXISTS spacecrafts CASCADE;');
    console.log('dropped all tables');
    
    // Recreate tables with proper constraints
    const { createDatabase } = require('./create_db');
    await createDatabase();
    
	console.log('!----------------------------!')
  console.log('\n db is reset and clean');
	console.log(' to populate the db with the csv data')
  console.log(' run the command below\n')
	console.log('npm run import-csv\n');

  } catch (error) {
    console.error('error reset db did not work', error.message);
  } finally {
	// clean up and close out
    await pool.end();
  }
}


// safety in case another file requires
// it wont run automatically
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };
