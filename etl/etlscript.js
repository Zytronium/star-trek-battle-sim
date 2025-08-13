const fs = require('fs');
const { Pool } = require('pg');
const csv = require('csv-parser');
require('dotenv').config({ path: './.env' });

// Database configuration use environment variables
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 5432,
});

async function loadData() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Load special effects first since weapons reference them
        await loadCsvData(client, './csv_files/special_effects.csv', 'special_effects', [
            {csv: 'effect_id', db: 'effect_id'},
            {csv: 'name', db: 'name'},
            {csv: 'type', db: 'type'},
            {csv: 'description', db: 'description'}
        ]);

        // Load weapons
        await loadCsvData(client, './csv_files/weapons.csv', 'weapons', [
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
        await loadCsvData(client, './csv_files/defenses.csv', 'defenses', [
            {csv: 'defense_id', db: 'defense_id'},
            {csv: 'name', db: 'name'},
            {csv: 'type', db: 'type'},
            {csv: 'description', db: 'description'},
            {csv: 'hit_points', db: 'hit_points'},
            {csv: 'effectiveness', db: 'effectiveness'},
            {csv: 'special_effects', db: 'special_effects'}
        ]);
        
        // Load regular ships
        const ships = await loadCsvDataToMemory('./csv_files/ships.csv');
        await insertShips(client, ships);
        
        // Load boss ships
        const bossShips = await loadCsvDataToMemory('./csv_files/boss_ships.csv');
        await insertBossShips(client, bossShips);
        
        // Load ship_weapons relationships
        await loadCsvData(client, './csv_files/ships_weapons.csv', 'ship_weapons', [
            {csv: 'ship_id', db: 'ship_id'},
            {csv: 'weapon_id', db: 'weapon_id'},
            {csv: 'damage_multiplier', db: 'damage_multiplier'},
            {csv: 'max_per_turn', db: 'max_per_turn'},
            {csv: 'cooldown_turns', db: 'cooldown_turns'},
            {csv: 'max_usage', db: 'max_usage'}
        ]);
        
        // Load ship_defenses relationships
        await loadCsvData(client, './csv_files/ships_defenses.csv', 'ship_defenses', [
            {csv: 'ship_id', db: 'ship_id'},
            {csv: 'defense_id', db: 'defense_id'}
        ]);
        
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

async function loadCsvDataToMemory(csvFile) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(csvFile)
            .pipe(csv())
            .on('data', (row) => results.push(row))
            .on('end', () => resolve(results))
            .on('error', reject);
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
                ship.ship_id, 
                ship.name, 
                ship.registry, 
                ship.class, 
                ship.owner,
                ship.description, 
                ship.shield_strength, 
                ship.hull_strength,
                ship.image_src
            ]
        );
    }
    console.log(`Loaded ${ships.length} regular ships`);
}

// Update the insertBossShips function
async function insertBossShips(client, bossShips) {
    for (const ship of bossShips) {
        await client.query(
            `INSERT INTO boss_ships (
                ship_id, name, class, owner, description, 
                ultimate_weapon, weapons, defenses, special,
                shield_strength, hull_strength, image_src
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (ship_id) DO UPDATE SET
                name = EXCLUDED.name,
                class = EXCLUDED.class,
                owner = EXCLUDED.owner,
                description = EXCLUDED.description,
                ultimate_weapon = EXCLUDED.ultimate_weapon,
                weapons = EXCLUDED.weapons,
                defenses = EXCLUDED.defenses,
                special = EXCLUDED.special,
                shield_strength = EXCLUDED.shield_strength,
                hull_strength = EXCLUDED.hull_strength,
                image_src = EXCLUDED.image_src`,
            [
                ship.ship_id, 
                ship.name, 
                ship.class, 
                ship.owner,
                ship.description, 
                ship.ultimate_weapon, 
                ship.weapons, 
                ship.defenses, 
                ship.special, 
                ship.shield_strength, 
                ship.hull_strength, 
                ship.image_src
            ]
        );
    }
    console.log(`Loaded ${bossShips.length} boss ships`);
}

// Execute the ETL process
loadData()
    .then(() => pool.end())
    .catch(err => {
        console.error('ETL process failed:', err);
        process.exit(1);
    });
