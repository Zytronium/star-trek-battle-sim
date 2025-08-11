-- weapons table
CREATE TABLE weapons (
    weapon_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    damage INT NOT NULL,
    shields_multiplier DECIMAL(5,2) NOT NULL,
    hull_multiplier DECIMAL(5,2) NOT NULL,
    special_effects TEXT,
    usage_limit INT
);

-- defenses table
CREATE TABLE IF NOT EXISTS defenses (
    defense_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    description TEXT,
    effectiveness DECIMAL(3,2),
    special_effects TEXT
);

-- Clear existing data if table exists
TRUNCATE defenses;

-- Insert the data
INSERT INTO defenses (defense_id, name, type, description, effectiveness, special_effects) VALUES
(0, 'Deflector Shields', 'Shield', 'Standard shield technology for Federation ships', 0.95, '["shielding"]'),
(1, 'Romulan Cloaking Device', 'Cloak', 'Allows ship to appear invisible, but shields must be down while the cloak is activated', 0.99, '["invisibility"]'),
(2, 'Phasing Cloaking Device', 'Cloak', 'Experimental Federation cloaking device that phases the ship out of normal space-time', 0.98, '["invisibility","phasing"]'),
(3, 'Ablative Armor', 'Armor', 'Advanced armor that ablates when hit', 0.85, '["damage_reduction"]'),
(4, 'Cloaking Device', 'Cloak', 'Standard cloaking technology', 0.97, '["invisibility"]'),
(5, 'Energy Dissipator', 'Shield', 'Breen energy-draining shield technology', 0.90, '["power_drain"]');

-- ships table
CREATE TABLE ships (
    ship_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    registry VARCHAR(20),
    class VARCHAR(50),
    owner VARCHAR(100),
    description TEXT,
    shield_strength INT,
    hull_strength INT,
    image_src TEXT
);

-- relationship tables
CREATE TABLE ship_weapons (
    ship_id INT REFERENCES ships(ship_id),
    weapon_id INT REFERENCES weapons(weapon_id),
    damage_multiplier DECIMAL(5,2) DEFAULT 1.0,
    max_per_turn INT DEFAULT 1,
    cooldown_turns INT DEFAULT 1,
    max_usage INT DEFAULT 99999,
    PRIMARY KEY (ship_id, weapon_id)
);

CREATE TABLE ship_defenses (
    ship_id INT REFERENCES ships(ship_id),
    defense_id INT REFERENCES defenses(defense_id),
    PRIMARY KEY (ship_id, defense_id)
);