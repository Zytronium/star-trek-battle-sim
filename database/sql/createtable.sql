-- Create tables in proper dependency order with consistent IF NOT EXISTS
CREATE TABLE IF NOT EXISTS weapons (
    weapon_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    damage INT NOT NULL,
    shields_multiplier DECIMAL(5,2) NOT NULL,
    hull_multiplier DECIMAL(5,2) NOT NULL,
    special_effects TEXT,
    usage_limit INT
);

CREATE TABLE IF NOT EXISTS defenses (
    defense_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    description TEXT,
    effectiveness DECIMAL(3,2),
    special_effects TEXT
);

CREATE TABLE IF NOT EXISTS ships (
    ship_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    registry VARCHAR(20),
    class VARCHAR(50),
    owner VARCHAR(100),
    description TEXT,
    shield_strength INT,
    hull_strength INT,
    image_src TEXT
);

CREATE TABLE IF NOT EXISTS ship_weapons (
    ship_id INT REFERENCES ships(ship_id),
    weapon_id INT REFERENCES weapons(weapon_id),
    damage_multiplier DECIMAL(5,2) DEFAULT 1.0,
    max_per_turn INT DEFAULT 1,
    cooldown_turns INT DEFAULT 1,
    max_usage INT DEFAULT 99999,
    PRIMARY KEY (ship_id, weapon_id)
);

CREATE TABLE IF NOT EXISTS ship_defenses (
    ship_id INT REFERENCES ships(ship_id),
    defense_id INT REFERENCES defenses(defense_id),
    PRIMARY KEY (ship_id, defense_id)
);