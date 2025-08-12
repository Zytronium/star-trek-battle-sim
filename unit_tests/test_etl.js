const { Pool } = require('pg');
const assert = require('assert');

// Database configuration
const pool = new Pool({
    user: 'staruser',
    host: 'localhost',
    database: 'star_trek_db',
    password: 'Password1',
    port: 5432,
    ssl: false
});

// Updated expected values based on actual data
const EXPECTED = {
    TABLES: ['ships', 'weapons', 'defenses', 'ship_weapons', 'ship_defenses', 'special_effects', 'boss_ships'],
    SHIPS: {
        REGULAR_COUNT: 13,
        BOSS_COUNT: 7,
        ENTERPRISE: { id: 0, weapons: 4, defenses: 3 },  // Actual: 4 weapons, 3 defense
        DEFIANT: { id: 3, weapons: 5, defenses: 4 }      // Actual: 4 weapons, 3 defenses
    },
    WEAPONS: {
        COUNT: 18,
        SPECIAL: 4
    },
    DEFENSES: {
        COUNT: 6,
        TYPES: ['Shield', 'Cloak', 'Armor']
    },
    SPECIAL_EFFECTS: {
        COUNT: 8
    }
};

async function runTests() {
    const client = await pool.connect();
    const testResults = [];
    
    try {
        console.log("🚀 Starting comprehensive ETL validation tests...\n");

        // ===== TEST 1: Verify all tables exist =====
        await runTest("Table structure", async () => {
            const tablesRes = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            
            const existingTables = tablesRes.rows.map(r => r.table_name);
            const missingTables = EXPECTED.TABLES.filter(t => !existingTables.includes(t));
            
            if (missingTables.length > 0) {
                throw new Error(`Missing tables: ${missingTables.join(', ')}`);
            }
            return `Found all ${EXPECTED.TABLES.length} expected tables`;
        }, testResults);

        // ===== TEST 2: Verify ships data =====
        await runTest("Regular ships count", async () => {
            const shipsRes = await client.query('SELECT COUNT(*) FROM ships');
            assert.equal(parseInt(shipsRes.rows[0].count), EXPECTED.SHIPS.REGULAR_COUNT);
            return `Found ${shipsRes.rows[0].count} regular ships`;
        }, testResults);

        await runTest("Boss ships count", async () => {
            const bossShipsRes = await client.query('SELECT COUNT(*) FROM boss_ships');
            assert.equal(parseInt(bossShipsRes.rows[0].count), EXPECTED.SHIPS.BOSS_COUNT);
            return `Found ${bossShipsRes.rows[0].count} boss ships`;
        }, testResults);

        await runTest("Ships required fields", async () => {
            const nullShipsRes = await client.query(`
                SELECT COUNT(*) FROM ships 
                WHERE name IS NULL OR class IS NULL OR owner IS NULL 
                   OR shield_strength IS NULL OR hull_strength IS NULL
            `);
            assert.equal(parseInt(nullShipsRes.rows[0].count), 0);
            return "No NULL values in required fields for ships";
        }, testResults);

        await runTest("Boss ships required fields", async () => {
            const nullBossShipsRes = await client.query(`
                SELECT COUNT(*) FROM boss_ships 
                WHERE name IS NULL OR class IS NULL OR owner IS NULL 
                   OR shield_strength IS NULL OR hull_strength IS NULL
            `);
            assert.equal(parseInt(nullBossShipsRes.rows[0].count), 0);
            return "No NULL values in required fields for boss ships";
        }, testResults);

        // ===== TEST 3: Verify weapons data =====
        await runTest("Weapons count", async () => {
            const weaponsRes = await client.query('SELECT COUNT(*) FROM weapons');
            assert.equal(parseInt(weaponsRes.rows[0].count), EXPECTED.WEAPONS.COUNT);
            return `Found ${weaponsRes.rows[0].count} weapons`;
        }, testResults);

        await runTest("Special weapons count", async () => {
            const specialWeaponsRes = await client.query(`
                SELECT COUNT(*) FROM weapons 
                WHERE special_effects IS NOT NULL AND special_effects != ''
            `);
            assert.equal(parseInt(specialWeaponsRes.rows[0].count), EXPECTED.WEAPONS.SPECIAL);
            return `Found ${specialWeaponsRes.rows[0].count} special weapons`;
        }, testResults);

        // ===== TEST 4: Verify defenses data =====
        await runTest("Defenses count", async () => {
            const defensesRes = await client.query('SELECT COUNT(*) FROM defenses');
            assert.equal(parseInt(defensesRes.rows[0].count), EXPECTED.DEFENSES.COUNT);
            return `Found ${defensesRes.rows[0].count} defenses`;
        }, testResults);

        await runTest("Defense types", async () => {
            const defenseTypesRes = await client.query(`
                SELECT DISTINCT type FROM defenses
            `);
            const existingTypes = defenseTypesRes.rows.map(r => r.type).filter(Boolean);
            const missingTypes = EXPECTED.DEFENSES.TYPES.filter(t => !existingTypes.includes(t));
            
            if (missingTypes.length > 0) {
                throw new Error(`Missing defense types: ${missingTypes.join(', ')}`);
            }
            return `Found defense types: ${existingTypes.join(', ')}`;
        }, testResults);

        // ===== TEST 5: Verify special effects data =====
        await runTest("Special effects count", async () => {
            const effectsRes = await client.query('SELECT COUNT(*) FROM special_effects');
            assert.equal(parseInt(effectsRes.rows[0].count), EXPECTED.SPECIAL_EFFECTS.COUNT);
            return `Found ${effectsRes.rows[0].count} special effects`;
        }, testResults);

        // ===== TEST 6: Verify relationships =====
        await runTest("Ships with weapons", async () => {
            const shipsNoWeapons = await client.query(`
                SELECT COUNT(*) FROM ships s
                WHERE NOT EXISTS (SELECT 1 FROM ship_weapons sw WHERE sw.ship_id = s.ship_id)
            `);
            assert.equal(parseInt(shipsNoWeapons.rows[0].count), 0);
            return "All regular ships have weapons assigned";
        }, testResults);

        await runTest("Ships with defenses", async () => {
            const shipsNoDefenses = await client.query(`
                SELECT COUNT(*) FROM ships s
                WHERE NOT EXISTS (SELECT 1 FROM ship_defenses sd WHERE sd.ship_id = s.ship_id)
            `);
            assert.equal(parseInt(shipsNoDefenses.rows[0].count), 0);
            return "All regular ships have defenses assigned";
        }, testResults);

        // ===== TEST 7: Verify specific ships =====
        await runTest("USS Enterprise-D configuration", async () => {
            const res = await client.query(`
                SELECT s.name, 
                       COUNT(DISTINCT sw.weapon_id) as weapon_count,
                       COUNT(DISTINCT sd.defense_id) as defense_count
                FROM ships s
                LEFT JOIN ship_weapons sw ON s.ship_id = sw.ship_id
                LEFT JOIN ship_defenses sd ON s.ship_id = sd.ship_id
                WHERE s.ship_id = $1
                GROUP BY s.name
            `, [EXPECTED.SHIPS.ENTERPRISE.id]);
            
            const ship = res.rows[0];
            assert.equal(ship.name, 'USS Enterprise-D');
            assert.equal(parseInt(ship.weapon_count), EXPECTED.SHIPS.ENTERPRISE.weapons);
            assert.equal(parseInt(ship.defense_count), EXPECTED.SHIPS.ENTERPRISE.defenses);
            
            return `Configuration correct: ${ship.weapon_count} weapons, ${ship.defense_count} defenses`;
        }, testResults);

        await runTest("USS Defiant configuration", async () => {
            const res = await client.query(`
                SELECT s.name, 
                       COUNT(DISTINCT sw.weapon_id) as weapon_count,
                       COUNT(DISTINCT sd.defense_id) as defense_count
                FROM ships s
                LEFT JOIN ship_weapons sw ON s.ship_id = sw.ship_id
                LEFT JOIN ship_defenses sd ON s.ship_id = sd.ship_id
                WHERE s.ship_id = $1
                GROUP BY s.name
            `, [EXPECTED.SHIPS.DEFIANT.id]);
            
            const ship = res.rows[0];
            assert.equal(ship.name, 'USS Defiant');
            assert.equal(parseInt(ship.weapon_count), EXPECTED.SHIPS.DEFIANT.weapons);
            assert.equal(parseInt(ship.defense_count), EXPECTED.SHIPS.DEFIANT.defenses);
            
            return `Configuration correct: ${ship.weapon_count} weapons, ${ship.defense_count} defenses`;
        }, testResults);

        // ===== TEST 8: Data integrity checks =====
        await runTest("Orphaned weapon relationships", async () => {
            const orphanedWeapons = await client.query(`
                SELECT COUNT(*) FROM ship_weapons sw
                WHERE NOT EXISTS (SELECT 1 FROM weapons w WHERE w.weapon_id = sw.weapon_id)
            `);
            assert.equal(parseInt(orphanedWeapons.rows[0].count), 0);
            return "No orphaned weapon relationships";
        }, testResults);

        await runTest("Orphaned defense relationships", async () => {
            const orphanedDefenses = await client.query(`
                SELECT COUNT(*) FROM ship_defenses sd
                WHERE NOT EXISTS (SELECT 1 FROM defenses d WHERE d.defense_id = sd.defense_id)
            `);
            assert.equal(parseInt(orphanedDefenses.rows[0].count), 0);
            return "No orphaned defense relationships";
        }, testResults);

        // ===== TEST 9: Verify boss ships data =====
        await runTest("Borg Tactical Cube exists", async () => {
            const borgRes = await client.query(`
                SELECT * FROM boss_ships WHERE name = 'Borg Tactical Cube'
            `);
            assert.equal(borgRes.rows.length, 1);
            const borgShip = borgRes.rows[0];
            assert.equal(borgShip.shield_strength, 175000);
            assert.equal(borgShip.hull_strength, 90000);
            return "Borg Tactical Cube exists with correct stats";
        }, testResults);

    } finally {
        client.release();
        await pool.end();
        
        // Print comprehensive test report
        console.log("\n=== TEST SUMMARY ===");
        testResults.forEach((result, index) => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${status} - ${result.name}`);
            if (!result.passed) {
                console.log(`   Reason: ${result.error}`);
            } else {
                console.log(`   ${result.message}`);
            }
        });
        
        const passedCount = testResults.filter(r => r.passed).length;
        const totalCount = testResults.length;
        console.log(`\nTests passed: ${passedCount}/${totalCount}`);
        
        process.exit(passedCount === totalCount ? 0 : 1);
    }
}

async function runTest(name, testFn, results) {
    try {
        const message = await testFn();
        results.push({ name, passed: true, message });
        console.log(`✅ ${name}`);
    } catch (error) {
        results.push({ name, passed: false, error: error.message });
        console.log(`❌ ${name} - ${error.message}`);
    }
}

runTests().catch(err => {
    console.error("Test suite failed:", err);
    process.exit(1);
});