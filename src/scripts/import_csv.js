// this file imports our csv data files weapons and spacecrafts
// and then adds the data to our tables

const fs = require('fs');
const csv = require('csv-parser');
const { pool } = require('../config/database');
// path to csv files
const path = require('path');

// function adds all the spacecrafts to spacecraft table
async function addSpacecrafts() {
  console.log('Importing spacecrafts...');
  
  const results = [];
  
  return new Promise((resolve, reject) => {
	// this opens the csv file, and then pipes it into parser
    fs.createReadStream(path.join(__dirname, '../../csv_files/star-trek-spacecrafts.csv'))
      .pipe(csv())
      .on('data', (data) => {
        // format the data to match table
        results.push({
          name: data.Name,
          class: data.Class,
          affiliation: data.Affiliation,
          registry: data.Registry,
          status: data.Status,
          description: data.Description
        });
      })
      .on('end', async () => {
        try {
          // insert all data into tables
		      // if it already exists, just update with the new data
          for (const spacecraft of results) {
            await pool.query(`
              INSERT INTO spacecrafts (name, class, affiliation, registry, status, description)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (name) DO UPDATE SET
                class = EXCLUDED.class,
                affiliation = EXCLUDED.affiliation,
                registry = EXCLUDED.registry,
                status = EXCLUDED.status,
                description = EXCLUDED.description
            `, [spacecraft.name, spacecraft.class, spacecraft.affiliation, spacecraft.registry, spacecraft.status, spacecraft.description]);
          }
          // log how many spacecrafts got imported
          console.log(`imported ${results.length} spacecrafts`);
          resolve(results);
        } catch (error) {
          console.error('error importing spacecrafts:', error);
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// import all at once in order
// weapons is dependant on spacecrafts so we need spacecrafts to work first
async function importAllData() {
  try {
	console.log('try import all');

	// call addSpacecrafts
	await addSpacecrafts();
	// count query for how many spacecrafts were added
	const spacecraftCount = await pool.query('SELECT COUNT(*) FROM spacecrafts');
	// log how many spacecrafts added
	console.log(`added ${spacecraftCount.rows[0].count} spacecrafts`)
	
  } catch (error) {
    console.error('error trying to import all', error);
    // close it out for cleanup
  } finally {
    await pool.end();
  }
}

// safety in case another file requires
// it wont run automatically
if (require.main === module) {
  importAllData();
}

module.exports = { importAllData, addSpacecrafts };
