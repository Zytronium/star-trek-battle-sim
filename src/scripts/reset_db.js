// this file just resets the database back to empty
// and then calls create db to start off fresh

const { pool } = require('../config/database');

async function resetDatabase() {
  console.log('\nRE-SETTING DB');
  console.log('----------------------------')
  
  try {
    // drop tables if already existing
	// only need to do spacecrafts and cascade since weapons depend on spacecrafts
    await pool.query('DROP TABLE IF EXISTS spacecrafts CASCADE;');
    console.log('dropped all tables');
    console.log('----------------------------')
    
    // Recreate tables with proper constraints
    const { createDatabase } = require('./create_db');
    await createDatabase();
    
	console.log('----------------------------')
  console.log('\n DB IS RESET AND CLEAN');
	console.log(' TO POPULATE WITH THE CSV DATA')
  console.log(' RUN THE COMMAND BELOW\n')
  console.log('----------------------------')
	console.log('\nnpm run import-csv\n');
  console.log('----------------------------')

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
