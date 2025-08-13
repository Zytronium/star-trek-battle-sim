// New database creation script with the updated schema
const { pool } = require('../config/database');

async function createDatabase() {
  console.log('\nCREATING NEW DATABASE SCHEMA');
  console.log('----------------------------')

  try {
    // Create tables in proper dependency order
    
    // 1. Create special_effects table first (no dependencies)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS special_effects (
        effect_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        type VARCHAR(50) NOT NULL,
        description TEXT
      );
    `);
    console.log('Created special_effects table');

    // 2. Create weapons table (references special_effects)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weapons (
        weapon_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        damage INT NOT NULL,
        shields_multiplier DECIMAL(5,2) NOT NULL,
        hull_multiplier DECIMAL(5,2) NOT NULL,
        special_effect_id INT REFERENCES special_effects(effect_id),
        usage_limit INT
      );
    `);
    console.log('Created weapons table');

    // 3. Create defenses table (references special_effects)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS defenses (
        defense_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50),
        description TEXT,
        hit_points INT,
        effectiveness DECIMAL(3,2),
        special_effect_id INT REFERENCES special_effects(effect_id)
      );
    `);
    console.log('Created defenses table');

    // 4. Create ships table (no dependencies)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ships (
        ship_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        registry VARCHAR(20),
        class VARCHAR(50) NOT NULL,
        owner VARCHAR(100) NOT NULL,
        description TEXT,
        shield_strength INT NOT NULL,
        hull_strength INT NOT NULL,
        image_src TEXT
      );
    `);
    console.log('Created ships table');

    // 5. Create boss_ships table (no dependencies)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS boss_ships (
        ship_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        class VARCHAR(50) NOT NULL,
        owner VARCHAR(100) NOT NULL,
        description TEXT,
        ultimate_weapon VARCHAR(100),
        weapons TEXT,
        defenses TEXT,
        special TEXT,
        shield_strength INT NOT NULL,
        hull_strength INT NOT NULL,
        image_src TEXT
      );
    `);
    console.log('Created boss_ships table');

    // 6. Create ship_weapons junction table (references ships and weapons)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ship_weapons (
        ship_id INT REFERENCES ships(ship_id) ON DELETE CASCADE,
        weapon_id INT REFERENCES weapons(weapon_id) ON DELETE CASCADE,
        damage_multiplier DECIMAL(5,2) DEFAULT 1.0,
        max_per_turn INT DEFAULT 1,
        cooldown_turns INT DEFAULT 1,
        max_usage INT DEFAULT 99999,
        PRIMARY KEY (ship_id, weapon_id)
      );
    `);
    console.log('Created ship_weapons table');

    // 7. Create ship_defenses junction table (references ships and defenses)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ship_defenses (
        ship_id INT REFERENCES ships(ship_id) ON DELETE CASCADE,
        defense_id INT REFERENCES defenses(defense_id) ON DELETE CASCADE,
        PRIMARY KEY (ship_id, defense_id)
      );
    `);
    console.log('Created ship_defenses table');

    // Create indexes for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_weapons_name ON weapons(name);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_defenses_name ON defenses(name);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ships_class ON ships(class);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ships_owner ON ships(owner);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_boss_ships_class ON boss_ships(class);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_boss_ships_owner ON boss_ships(owner);');
    console.log('Created performance indexes');

    console.log('\nDATABASE SCHEMA CREATED SUCCESSFULLY!');
    console.log('----------------------------');
    console.log('Tables created:');
    console.log('• special_effects (effect_id, name, type, description)');
    console.log('• weapons (weapon_id, name, description, damage, shields_multiplier, hull_multiplier, special_effect_id, usage_limit)');
    console.log('• defenses (defense_id, name, type, description, hit_points, effectiveness, special_effect_id)');
    console.log('• ships (ship_id, name, registry, class, owner, description, shield_strength, hull_strength, image_src)');
    console.log('• boss_ships (ship_id, name, class, owner, description, ultimate_weapon, weapons, defenses, special, shield_strength, hull_strength, image_src)');
    console.log('• ship_weapons (ship_id, weapon_id, damage_multiplier, max_per_turn, cooldown_turns, max_usage)');
    console.log('• ship_defenses (ship_id, defense_id)');

  } catch (error) {
    console.error('Error creating database schema:', error.message);
    throw error;
  }
}

// Only run if called directly
if (require.main === module) {
  createDatabase()
    .then(() => {
      console.log('\nDatabase creation completed successfully!');
      return pool.end();
    })
    .catch((error) => {
      console.error('Database creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createDatabase };
