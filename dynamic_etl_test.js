const { Pool } = require('pg');
const pool = new Pool({
    user: 'staruser',
    host: 'localhost',
    database: 'star_trek_db',
    password: 'Password1',
    port: 5432,
    ssl: false
});

// Configuration with minimum expected values
const config = {
    MIN_SHIPS: 10,
    MIN_WEAPONS: 10,
    MIN_DEFENSES: 3,
    MIN_SHIP_WEAPONS: 20,
    MIN_SHIP_DEFENSES: 15,
    REQUIRED_DEFENSE_TYPES: ['Shield', 'Cloak'],
    REQUIRED_WEAPON_TYPES: ['Phaser', 'Torpedo', 'Disruptor']
};

async function runDynamicTests() {
    const client = await pool.connect();
    const testResults = {
        passed: 0,
        warnings: 0,
        failed: 0,
        details: []
    };

    try {
        console.log("🔍 Starting Dynamic Database Validation...\n");

        // 1. Test Database Structure
        await testTableStructure(client, testResults);

        // 2. Test Data Completeness
        await testDataCompleteness(client, testResults);

        // 3. Test Relationships
        await testRelationships(client, testResults);

        // 4. Test Business Rules
        await testBusinessRules(client, testResults);

        // 5. Generate Data Profile
        await generateDataProfile(client, testResults);

    } catch (err) {
        recordResult(testResults, 'CRITICAL', `Test framework error: ${err.message}`);
    } finally {
        client.release();
        await pool.end();

        // Print Summary
        console.log("\n=== TEST SUMMARY ===");
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`⚠️  Warnings: ${testResults.warnings}`);
        console.log(`❌ Failed: ${testResults.failed}\n`);

        // Print detailed results
        testResults.details.forEach((result, index) => {
            console.log(`${index + 1}. ${result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌'} ${result.message}`);
            if (result.details) console.log(`   → ${result.details}`);
        });

        process.exit(testResults.failed > 0 ? 1 : 0);
    }
}

// ===== Test Functions =====

async function testTableStructure(client, results) {
    const requiredTables = ['ships', 'weapons', 'defenses', 'ship_weapons', 'ship_defenses'];
    const existingTables = (await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `)).rows.map(r => r.table_name);

    requiredTables.forEach(table => {
        if (existingTables.includes(table)) {
            recordResult(results, 'PASS', `Table exists: ${table}`);
        } else {
            recordResult(results, 'FAIL', `Missing table: ${table}`);
        }
    });
}

async function testDataCompleteness(client, results) {
    // Ships
    const shipCount = (await client.query('SELECT COUNT(*) FROM ships')).rows[0].count;
    if (shipCount >= config.MIN_SHIPS) {
        recordResult(results, 'PASS', `Ships count: ${shipCount} (>= ${config.MIN_SHIPS})`);
    } else {
        recordResult(results, 'WARN', `Low ships count: ${shipCount} (< ${config.MIN_SHIPS})`);
    }

    // Weapons
    const weaponCount = (await client.query('SELECT COUNT(*) FROM weapons')).rows[0].count;
    if (weaponCount >= config.MIN_WEAPONS) {
        recordResult(results, 'PASS', `Weapons count: ${weaponCount} (>= ${config.MIN_WEAPONS})`);
    } else {
        recordResult(results, 'WARN', `Low weapons count: ${weaponCount} (< ${config.MIN_WEAPONS})`);
    }

    // Defenses
    const defenseCount = (await client.query('SELECT COUNT(*) FROM defenses')).rows[0].count;
    if (defenseCount >= config.MIN_DEFENSES) {
        recordResult(results, 'PASS', `Defenses count: ${defenseCount} (>= ${config.MIN_DEFENSES})`);
    } else {
        recordResult(results, 'WARN', `Low defenses count: ${defenseCount} (< ${config.MIN_DEFENSES})`);
    }
}

async function testRelationships(client, results) {
    // Ship-Weapons
    const shipWeapons = (await client.query('SELECT COUNT(*) FROM ship_weapons')).rows[0].count;
    if (shipWeapons >= config.MIN_SHIP_WEAPONS) {
        recordResult(results, 'PASS', `Ship-Weapon relationships: ${shipWeapons} (>= ${config.MIN_SHIP_WEAPONS})`);
    } else {
        recordResult(results, 'WARN', `Low ship-weapon relationships: ${shipWeapons} (< ${config.MIN_SHIP_WEAPONS})`);
    }

    // Ship-Defenses
    const shipDefenses = (await client.query('SELECT COUNT(*) FROM ship_defenses')).rows[0].count;
    if (shipDefenses >= config.MIN_SHIP_DEFENSES) {
        recordResult(results, 'PASS', `Ship-Defense relationships: ${shipDefenses} (>= ${config.MIN_SHIP_DEFENSES})`);
    } else {
        recordResult(results, 'WARN', `Low ship-defense relationships: ${shipDefenses} (< ${config.MIN_SHIP_DEFENSES})`);
    }

    // Check for ships without weapons
    const shipsWithoutWeapons = (await client.query(`
        SELECT COUNT(*) FROM ships s
        WHERE NOT EXISTS (SELECT 1 FROM ship_weapons sw WHERE sw.ship_id = s.ship_id)
    `)).rows[0].count;
    
    if (shipsWithoutWeapons === 0) {
        recordResult(results, 'PASS', 'All ships have at least one weapon');
    } else {
        recordResult(results, 'WARN', `${shipsWithoutWeapons} ships have no weapons assigned`);
    }
}

async function testBusinessRules(client, results) {
    // Check required defense types
    const defenseTypes = (await client.query('SELECT DISTINCT type FROM defenses')).rows.map(r => r.type);
    config.REQUIRED_DEFENSE_TYPES.forEach(type => {
        if (defenseTypes.includes(type)) {
            recordResult(results, 'PASS', `Required defense type present: ${type}`);
        } else {
            recordResult(results, 'FAIL', `Missing required defense type: ${type}`);
        }
    });

    // Check weapon naming patterns
    const weaponNames = (await client.query('SELECT name FROM weapons')).rows.map(r => r.name);
    config.REQUIRED_WEAPON_TYPES.forEach(type => {
        const hasType = weaponNames.some(name => name.includes(type));
        if (hasType) {
            recordResult(results, 'PASS', `Weapon type pattern found: ${type}`);
        } else {
            recordResult(results, 'WARN', `No weapons found for type: ${type}`);
        }
    });

    // Check for ships with missing stats
    const shipsMissingStats = (await client.query(`
        SELECT COUNT(*) FROM ships 
        WHERE shield_strength IS NULL OR hull_strength IS NULL
    `)).rows[0].count;
    
    if (shipsMissingStats === 0) {
        recordResult(results, 'PASS', 'All ships have shield and hull values');
    } else {
        recordResult(results, 'FAIL', `${shipsMissingStats} ships missing shield/hull values`);
    }
}

async function generateDataProfile(client, results) {
    console.log("\n📊 Data Profile:");
    
    // Ships by class
    const shipsByClass = (await client.query(`
        SELECT class, COUNT(*) as count 
        FROM ships 
        GROUP BY class 
        ORDER BY count DESC
    `)).rows;
    console.log("\n🛸 Ships by Class:");
    shipsByClass.forEach(row => console.log(`- ${row.class}: ${row.count}`));

    // Weapons by type
    const weaponsByType = (await client.query(`
        SELECT 
            CASE 
                WHEN name LIKE '%Phaser%' THEN 'Phaser'
                WHEN name LIKE '%Torpedo%' THEN 'Torpedo'
                WHEN name LIKE '%Disruptor%' THEN 'Disruptor'
                ELSE 'Other'
            END as weapon_type,
            COUNT(*) as count
        FROM weapons
        GROUP BY weapon_type
    `)).rows;
    console.log("\n💥 Weapons by Type:");
    weaponsByType.forEach(row => console.log(`- ${row.weapon_type}: ${row.count}`));

    // Defenses distribution
    const defensesDistribution = (await client.query(`
        SELECT d.name, COUNT(sd.ship_id) as ship_count
        FROM defenses d
        LEFT JOIN ship_defenses sd ON d.defense_id = sd.defense_id
        GROUP BY d.name
        ORDER BY ship_count DESC
    `)).rows;
    console.log("\n🛡️ Defenses Distribution:");
    defensesDistribution.forEach(row => console.log(`- ${row.name}: ${row.ship_count} ships`));
}

function recordResult(results, status, message, details = null) {
    const result = { status, message };
    if (details) result.details = details;
    
    results.details.push(result);
    if (status === 'PASS') results.passed++;
    else if (status === 'WARN') results.warnings++;
    else results.failed++;
}

runDynamicTests();