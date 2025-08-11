const fs = require('fs');
const { Pool } = require('pg');
const csv = require('csv-parser');

// Database configuration
const pool = new Pool({
    user: 'staruser',
    host: 'localhost',
    database: 'star_trek_db',
    password: 'Password1',
    port: 5432,
});

async function loadData() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Load weapons
        await loadCsvData(client, 'weapons_2.csv', 'weapons', [
            {csv: 'weapon_id', db: 'weapon_id'},
            {csv: 'name', db: 'name'},
            {csv: 'description', db: 'description'},
            {csv: 'damage', db: 'damage'},
            {csv: 'shields_multiplier', db: 'shields_multiplier'},
            {csv: 'hull_multiplier', db: 'hull_multiplier'},
            {csv: 'special_effects', db: 'special_effects'},
            {csv: 'usage_limit', db: 'usage_limit'}
        ]);

        // Load defenses
        await loadCsvData(client, 'defenses.csv', 'defenses', [
            {csv: 'defense_id', db: 'defense_id'},
            {csv: 'name', db: 'name'},
            {csv: 'type', db: 'type'},
            {csv: 'description', db: 'description'},
            {csv: 'effectiveness', db: 'effectiveness'},
            {csv: 'special_effects', db: 'special_effects'}
        ]);
        
        // Load ships with default values
        const ships = await loadShipsWithDefaults('ships_2.csv');
        await insertShips(client, ships);
        
        // Load ship_weapons relationships
        await loadCsvData(client, 'ships_weapons_2.csv', 'ship_weapons', [
            {csv: 'ship_id', db: 'ship_id'},
            {csv: 'weapon_id', db: 'weapon_id'},
            {csv: 'damage_multiplier', db: 'damage_multiplier'},
            {csv: 'max_per_turn', db: 'max_per_turn'},
            {csv: 'cooldown_turns', db: 'cooldown_turns'},
            {csv: 'max_usage', db: 'max_usage'}
        ]);
        
        // Load ship_defenses relationships if file exists
        if (fs.existsSync('ship_defenses.csv')) {
            await loadCsvData(client, 'ship_defenses.csv', 'ship_defenses', [
                {csv: 'ship_id', db: 'ship_id'},
                {csv: 'defense_id', db: 'defense_id'}
            ]);
        } else {
            console.log('ship_defenses.csv not found - skipping defenses loading');
        }
        
        await client.query('COMMIT');
        console.log('All data loaded successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error loading data:', err);
    } finally {
        client.release();
    }
}

async function loadCsvData(client, csvFile, tableName, columnMappings) {
    return new Promise((resolve, reject) => {
        const rows = [];
        
        fs.createReadStream(csvFile)
            .pipe(csv())
            .on('data', (row) => {
                const dbRow = {};
                columnMappings.forEach(mapping => {
                    dbRow[mapping.db] = row[mapping.csv] !== '' ? row[mapping.csv] : null;
                });
                rows.push(dbRow);
            })
            .on('end', async () => {
                try {
                    if (rows.length === 0) {
                        console.log(`No data found in ${csvFile}`);
                        return resolve();
                    }
                    
                    const columns = Object.keys(rows[0]);
                    const placeholders = columns.map((_, i) => `$${i+1}`).join(',');
                    const query = `
                        INSERT INTO ${tableName} (${columns.join(',')})
                        VALUES (${placeholders})
                        ON CONFLICT DO NOTHING`;
                    
                    for (const row of rows) {
                        const values = columns.map(col => row[col]);
                        await client.query(query, values);
                    }
                    
                    console.log(`Loaded ${rows.length} rows into ${tableName}`);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            })
            .on('error', reject);
    });
}

async function loadShipsWithDefaults(csvFile) {
    const ships = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(csvFile)
            .pipe(csv())
            .on('data', (row) => results.push(row))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
    
    return setDefaultStats(ships);
}

function setDefaultStats(ships) {
    const classDefaults = {
        // Federation
        'Galaxy': { shield: 1500, hull: 1200 },
        'Intrepid': { shield: 1000, hull: 800 },
        'Defiant': { shield: 1100, hull: 900 },
        'Oberth': { shield: 400, hull: 300 },
        
        // Klingon
        'Negh\'Var': { shield: 1800, hull: 1600 },
        'Bird of Prey': { shield: 800, hull: 700 },
        
        // Romulan
        'D\'deridex-class Warbird': { shield: 1600, hull: 1400 },
        
        // Cardassian
        'Galor': { shield: 950, hull: 850 },
        'Keldon': { shield: 1100, hull: 950 },
        
        // Dominion
        'Attack Fighter': { shield: 600, hull: 500 },
        
        // Mirror Universe
        'Charon': { shield: 2000, hull: 1800 }
    };

    return ships.map(ship => {
        const defaults = classDefaults[ship.class] || { shield: 800, hull: 600 };
        const shield = ship.shield_strength ? parseInt(ship.shield_strength) : defaults.shield;
        const hull = ship.hull_strength ? parseInt(ship.hull_strength) : defaults.hull;
        
        return {
            ...ship,
            shield_strength: shield.toString(),
            hull_strength: hull.toString()
        };
    });
}

async function insertShips(client, ships) {
    for (const ship of ships) {
        await client.query(
            `INSERT INTO ships (
                ship_id, name, registry, class, owner, description, 
                shield_strength, hull_strength, image_src
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (ship_id) DO UPDATE SET
                name = EXCLUDED.name,
                registry = EXCLUDED.registry,
                class = EXCLUDED.class,
                owner = EXCLUDED.owner,
                description = EXCLUDED.description,
                shield_strength = EXCLUDED.shield_strength,
                hull_strength = EXCLUDED.hull_strength,
                image_src = EXCLUDED.image_src`,
            [
                ship.ship_id, ship.name, ship.registry, ship.class, ship.owner,
                ship.description, ship.shield_strength, ship.hull_strength,
                ship.image_src
            ]
        );
    }
    console.log(`Loaded ${ships.length} ships with default values where needed`);
}

// Execute the ETL process
loadData()
    .then(() => pool.end())
    .catch(err => {
        console.error('ETL process failed:', err);
        process.exit(1);
    });