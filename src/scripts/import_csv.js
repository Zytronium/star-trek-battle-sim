// this file imports our csv data files weapons and spacecrafts
// and then adds the data to our tables

const fs = require('fs');
const csv = require('csv-parser');
const { pool } = require('../config/database');
// path to csv files
const path = require('path');

// function adds all the spacecrafts to spacecraft table
async function addSpacecrafts() {
  console.log('\nImporting spacecrafts...');
  
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

// function adds all the weapons to spacecraft table
async function addWeapons() {
  console.log('Importing weapons...');
  
  const results = [];
  
  return new Promise((resolve, reject) => {
	  // this opens the csv file, and then pipes it into parser
    fs.createReadStream(path.join(__dirname, '../../csv_files/star-trek-weapons.csv'))
      .pipe(csv())
      .on('data', (data) => {
        // format the data to match table
        results.push({
          spacecraft_name: data.Spacecraft,
          weapon_type: data.WeaponType,
          weapon_name: data.WeaponName,
          description: data.Description,
          affiliation: data.Affiliation,
          era: data.Era
        });
      })
      .on('end', async () => {
        try {
          // insert all data into tables
		      // if it already exists, just update with the new data
          for (const weapon of results) {
            // have to get spacecraft id from spacecrafts table
            // weapons are linked to the spacecraft by id by name
            const spacecraftResult = await pool.query(
              'SELECT id FROM spacecrafts WHERE name = $1',
              [weapon.spacecraft_name]
            );
            
            // if a weapon doesnt match an id, then skip
            // if the weapon is a match to a spacecraft then we want to link it
            if (spacecraftResult.rows.length > 0) {
              const spacecraft_id = spacecraftResult.rows[0].id;
              
              // query just adds all data into table
              // needed to add ON CONFLICT to this also, was creating duplicates
              await pool.query(`
                INSERT INTO weapons (spacecraft_id, weapon_type, weapon_name, description, affiliation, era)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
              `, [spacecraft_id, weapon.weapon_type, weapon.weapon_name, weapon.description, weapon.affiliation, weapon.era]);
            } else {
              console.log(`error not found "${weapon.spacecraft_name}" skip`);
            }
          }
          // log how many spacecrafts got imported
          console.log(`imported ${results.length} weapons`);
          resolve(results);
        } catch (error) {
          console.error('error importing weapons:', error);
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
	// count query for how many spacecrafts were total
	const spacecraftCount = await pool.query('SELECT COUNT(*) FROM spacecrafts');
	// log how many spacecrafts total
	console.log(`total ${spacecraftCount.rows[0].count} spacecrafts`)

  // call addWeapons
	await addWeapons();
	// count query for how many weapons were total
	const weaponsCount = await pool.query('SELECT COUNT(*) FROM weapons');
	// log how many weapons total
	console.log(`total ${weaponsCount.rows[0].count} weapons`)
	
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

module.exports = { importAllData, addSpacecrafts, addWeapons };
