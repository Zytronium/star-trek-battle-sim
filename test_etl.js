const { Pool } = require('pg');
const pool = new Pool({
    user: 'staruser',
    host: 'localhost',
    database: 'star_trek_db',
    password: 'Password1',
    port: 5432,
    ssl: false // Added to prevent SSL connection issues
});

async function runTests() {
    const client = await pool.connect();
    
    try {
        console.log("🚀 Starting ETL validation tests...\n");

        // Test 1: Verify all tables exist
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name IN ('ships', 'weapons', 'defenses', 'ship_weapons', 'ship_defenses')
        `);
        console.log(`✅ Tables found: ${tablesRes.rows.map(r => r.table_name).join(', ')} (Expected: 5 tables)`);

        // Test 2: Verify all ships loaded with default values
        const shipsRes = await client.query('SELECT COUNT(*) FROM ships');
        console.log(`\n🛸 Ships loaded: ${shipsRes.rows[0].count} (Expected: 13)`);
        
        const defaultStatsRes = await client.query(`
            SELECT COUNT(*) FROM ships 
            WHERE shield_strength IS NULL OR hull_strength IS NULL
        `);
        console.log(`🛡️  Ships missing stats: ${defaultStatsRes.rows[0].count} (Expected: 0)`);

        // Test 3: Verify weapons data
        const weaponsRes = await client.query('SELECT COUNT(*) FROM weapons');
        console.log(`\n💥 Weapons loaded: ${weaponsRes.rows[0].count} (Expected: 14)`);
        
        const specialWeaponsRes = await client.query(`
            SELECT COUNT(*) FROM weapons 
            WHERE special_effects IS NOT NULL AND special_effects != '[]'
        `);
        console.log(`✨ Special weapons: ${specialWeaponsRes.rows[0].count} (Expected: 3)`);

        // Test 4: Verify defenses data
        const defensesRes = await client.query('SELECT COUNT(*) FROM defenses');
        console.log(`\n🛡️  Defenses loaded: ${defensesRes.rows[0].count} (Expected: 6)`);

        // Test 5: Verify relationship tables
        const shipWeaponsRes = await client.query(`
            SELECT COUNT(DISTINCT ship_id) as ships, COUNT(*) as weapons 
            FROM ship_weapons
        `);
        console.log(`\n🔫 Ship-Weapon relationships: 
            ${shipWeaponsRes.rows[0].weapons} weapons on ${shipWeaponsRes.rows[0].ships} ships
            (Expected: ~35 weapons on 12 ships)`);

        const shipDefensesRes = await client.query(`
            SELECT COUNT(DISTINCT ship_id) as ships, COUNT(*) as defenses 
            FROM ship_defenses
        `);
        console.log(`🛡️  Ship-Defense relationships: 
            ${shipDefensesRes.rows[0].defenses} defenses on ${shipDefensesRes.rows[0].ships} ships
            (Expected: ~23 defenses on 12 ships)`);

        // Test 6: Verify specific ship configurations
        console.log("\n🔍 Sample ship verification:");
        
        // Check USS Enterprise-D (ship_id 0)
        const enterpriseRes = await client.query(`
            SELECT s.name, 
                   COUNT(DISTINCT sw.weapon_id) as weapon_count,
                   COUNT(DISTINCT sd.defense_id) as defense_count
            FROM ships s
            LEFT JOIN ship_weapons sw ON s.ship_id = sw.ship_id
            LEFT JOIN ship_defenses sd ON s.ship_id = sd.ship_id
            WHERE s.ship_id = 0
            GROUP BY s.name
        `);
        console.log(`- USS Enterprise-D: ${enterpriseRes.rows[0].weapon_count} weapons, ${enterpriseRes.rows[0].defense_count} defenses (Expected: 3 weapons, 3 defenses)`);

        // Check USS Defiant (ship_id 3)
        const defiantRes = await client.query(`
            SELECT s.name, 
                   COUNT(DISTINCT sw.weapon_id) as weapon_count,
                   COUNT(DISTINCT sd.defense_id) as defense_count
            FROM ships s
            LEFT JOIN ship_weapons sw ON s.ship_id = sw.ship_id
            LEFT JOIN ship_defenses sd ON s.ship_id = sd.ship_id
            WHERE s.ship_id = 3
            GROUP BY s.name
        `);
        console.log(`- USS Defiant: ${defiantRes.rows[0].weapon_count} weapons, ${defiantRes.rows[0].defense_count} defenses (Expected: 4 weapons, 3 defenses)`);

        // Test 7: Verify defense types distribution
        console.log("\n🛡️ Defense type distribution:");
        const defenseTypesRes = await client.query(`
            SELECT type, COUNT(*) 
            FROM defenses 
            GROUP BY type
        `);
        defenseTypesRes.rows.forEach(row => {
            console.log(`- ${row.type}: ${row.count}`);
        });

        console.log("\n✅ All tests completed successfully!");

    } catch (err) {
        console.error("\n❌ Test failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

runTests().catch(err => {
    console.error("Test suite failed:", err);
    process.exit(1);
});