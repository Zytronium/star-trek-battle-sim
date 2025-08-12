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

// Expected values (adjust these based on your actual data)
const EXPECTED = {
    TABLES: ['ships', 'weapons', 'defenses', 'ship_weapons', 'ship_defenses'],
    SHIPS: {
        COUNT: 13,
        ENTERPRISE: { id: 0, weapons: 3, defenses: 3 },
        DEFIANT: { id: 3, weapons: 4, defenses: 3 }
    },
    WEAPONS: {
        COUNT: 14,
        SPECIAL: 3
    },
    DEFENSES: {
        COUNT: 6,
        TYPES: ['Shield', 'Hull', 'Cloaking']
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
        await runTest("Ships count", async () => {
            const shipsRes = await client.query('SELECT COUNT(*) FROM ships');
            assert.equal(parseInt(shipsRes.rows[0].count), EXPECTED.SHIPS.COUNT);
            return `Found ${shipsRes.rows[0].count} ships`;
        }, testResults);

        await runTest("Ships required fields", async () => {
            const nullShipsRes = await client.query(`
                SELECT COUNT(*) FROM ships 
                WHERE name IS NULL OR registry IS NULL OR class IS NULL
            `);
            assert.equal(parseInt(nullShipsRes.rows[0].count), 0);
            return "No NULL values in required fields";
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
                WHERE special_effects IS NOT NULL AND special_effects != '[]'
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
            const existingTypes = defenseTypesRes.rows.map(r => r.type);
            const missingTypes = EXPECTED.DEFENSES.TYPES.filter(t => !existingTypes.includes(t));
            
            if (missingTypes.length > 0) {
                throw new Error(`Missing defense types: ${missingTypes.join(', ')}`);
            }
            return `Found defense types: ${existingTypes.join(', ')}`;
        }, testResults);

        // ===== TEST 5: Verify relationships =====
        await runTest("Ships with weapons", async () => {
            const shipsNoWeapons = await client.query(`
                SELECT COUNT(*) FROM ships s
                WHERE NOT EXISTS (SELECT 1 FROM ship_weapons sw WHERE sw.ship_id = s.ship_id)
            `);
            assert.equal(parseInt(shipsNoWeapons.rows[0].count), 0);
            return "All ships have weapons assigned";
        }, testResults);

        await runTest("Ships with defenses", async () => {
            const shipsNoDefenses = await client.query(`
                SELECT COUNT(*) FROM ships s
                WHERE NOT EXISTS (SELECT 1 FROM ship_defenses sd WHERE sd.ship_id = s.ship_id)
            `);
            assert.equal(parseInt(shipsNoDefenses.rows[0].count), 0);
            return "All ships have defenses assigned";
        }, testResults);

        // ===== TEST 6: Verify specific ships =====
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

        // ===== TEST 7: Data integrity checks =====
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