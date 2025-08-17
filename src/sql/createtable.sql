CREATE TABLE IF NOT EXISTS special_effects (
    effect_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS weapons (
    weapon_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    damage INT NOT NULL,
    shields_multiplier DECIMAL(5,2) NOT NULL,
    hull_multiplier DECIMAL(5,2) NOT NULL,
    special_effects VARCHAR(100),
    usage_limit INT
);

CREATE TABLE IF NOT EXISTS defenses (
    defense_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    description TEXT,
    hit_points INT,
    effectiveness DECIMAL(3,2),
    special_effects VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS ships (
    ship_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    registry VARCHAR(20),
    class VARCHAR(50) NOT NULL,
    owner VARCHAR(100) NOT NULL,
    description TEXT,
    shield_strength INT NOT NULL,
    hull_strength INT NOT NULL,
    attack_power INT DEFAULT 100,
    speed_rating INT DEFAULT 5,   
    image_src TEXT,
    evasion_chance DECIMAL(5,4) NOT NULL DEFAULT 0.1,
    critical_chance DECIMAL(5,4) NOT NULL DEFAULT 0.05
);

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
    attack_power INT DEFAULT 300,
    speed_rating INT DEFAULT 3,
    special_ability VARCHAR, 
    image_src TEXT,
    evasion_chance DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    critical_chance DECIMAL(5,4) NOT NULL DEFAULT 0.15
);

CREATE TABLE IF NOT EXISTS ship_weapons (
    ship_id INT REFERENCES ships(ship_id) ON DELETE CASCADE,
    weapon_id INT REFERENCES weapons(weapon_id) ON DELETE CASCADE,
    damage_multiplier DECIMAL(5,2) DEFAULT 1.0,
    max_per_turn INT DEFAULT 1,
    cooldown_turns INT DEFAULT 1,
    max_usage INT DEFAULT 99999,
    PRIMARY KEY (ship_id, weapon_id)
);

CREATE TABLE IF NOT EXISTS ship_defenses (
    ship_id INT REFERENCES ships(ship_id) ON DELETE CASCADE,
    defense_id INT REFERENCES defenses(defense_id) ON DELETE CASCADE,
    PRIMARY KEY (ship_id, defense_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_weapons_name ON weapons(name);
CREATE INDEX IF NOT EXISTS idx_defenses_name ON defenses(name);
CREATE INDEX IF NOT EXISTS idx_ships_class ON ships(class);
CREATE INDEX IF NOT EXISTS idx_ships_owner ON ships(owner);
CREATE INDEX IF NOT EXISTS idx_boss_ships_class ON boss_ships(class);
CREATE INDEX IF NOT EXISTS idx_boss_ships_owner ON boss_ships(owner);