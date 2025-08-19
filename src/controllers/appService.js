const { pool } = require("../config/database");

class AppService {
  // ======== Get Database ======== \\
  static async getDatabase() {
    // Note: this does not get the entire database anymore, which means some tables may not be returned here.
    try {
      const ships = await pool.query('SELECT * FROM ships');
      // const bossShips = await pool.query('SELECT * FROM boss_ships'); // Uncomment if we implement bosses
      const weapons = await pool.query('SELECT * FROM weapons');
      const defenses = await pool.query('SELECT * FROM defenses');
      const shipWeapons = await pool.query('SELECT * FROM ship_weapons');
      const shipDefenses = await pool.query('SELECT * FROM ship_defenses');

      return {
        ships: ships.rows,
        // boss_ships: bossShips.rows, // Uncomment if we implement bosses
        weapons: weapons.rows,
        defenses: defenses.rows,
        ship_weapons: shipWeapons.rows,
        ship_defenses: shipDefenses.rows
      }
    } catch (e) {
      throw new Error(`Database query failed: ${e.message}`);
    }
  }

  // ======== Get All Bosses ======== \\
  static async getBosses() {
    try {
      const result = pool.query('SELECT * FROM boss_ships');
      return result.rows;
    } catch (e) {
      throw new Error(`Database query failed: ${e.message}`);
    }
  }

  // ======== Get a Boss ======== \\
  static async getBossByID(id) {
    let result;
    try {
      result = await pool.query('SELECT * FROM boss_ships WHERE ship_id = $1', [id]);
    } catch (e) {
      throw new Error(`Database query failed: ${e.message}`);
    }

    if (result.rows.length === 0) {
      throw new Error(`Boss Ship with ID ${id} not found`);
    }

    return (result.rows[0]);
  }

  // ======== Get All Ships ======== \\
  static async getShips() {
    // Gets base data on all ships (no weapons or defenses)
    try {
      const result = await pool.query('SELECT * FROM ships');
      return result.rows;
    } catch (e) {
      throw new Error(`Database query failed: ${e.message}`);
    }
  }

  // ====== Get All Ships + Weapons & Defenses ====== \\
  static async getShipsFull() {
    // Gets all ships and combines their weapons, defenses, and unique weapons stats
    try {
      const shipsRes = await pool.query('SELECT * FROM ships');
      const weaponsRes = await pool.query('SELECT * FROM weapons');
      const defensesRes = await pool.query('SELECT * FROM defenses');
      const shipWeaponsRes = await pool.query('SELECT * FROM ship_weapons');
      const shipDefensesRes = await pool.query('SELECT * FROM ship_defenses');

      const weapons = weaponsRes.rows;
      const defenses = defensesRes.rows;

      const weaponMap = Object.fromEntries(weapons.map(w => [w.weapon_id, w]));
      const defenseMap = Object.fromEntries(defenses.map(d => [d.defense_id, d]));

      const shipWeapons = shipWeaponsRes.rows;
      const shipDefenses = shipDefensesRes.rows;

      return shipsRes.rows.map(ship => {
        // Weapons: combine without ship_id or usage_limit
        const weaponsForShip = shipWeapons
          .filter(sw => sw.ship_id === ship.ship_id)
          .map(sw => {
            const { usage_limit, ...weaponBase } = weaponMap[sw.weapon_id]; // drop usage_limit
            const { ship_id, weapon_id, ...joinData } = sw; // drop ship_id
            return {
              weapon_id: sw.weapon_id,
              ...weaponBase,
              ...joinData
            };
          });

        // Defenses: combine without ship_id
        const defensesForShip = shipDefenses
          .filter(sd => sd.ship_id === ship.ship_id)
          .map(sd => {
            const { ship_id, ...joinData } = sd;
            return {
              defense_id: sd.defense_id,
              ...defenseMap[sd.defense_id],
              ...joinData
            };
          });

        return {
          ...ship,
          weapons: weaponsForShip,
          defenses: defensesForShip
        };
      });
    } catch (e) {
      throw new Error(`Database query failed: ${e.message}`);
    }
  }

  // ======== Get a Ship ======== \\
  static async getShipByID(id) {
    // Gets the basic ship info for a specific ship (no weapons or defenses)
    let result;
    try {
      result = await pool.query('SELECT * FROM ships WHERE ship_id = $1', [id]);
    } catch (e) {
      throw new Error(`Database query failed: ${e.message}`);
    }

    if (result.rows.length === 0) {
      throw new Error(`Ship with ID ${id} not found`);
    }

    return (result.rows[0]);
  }

  // ====== Get a Ship + Weapons & Defenses ====== \\
  static async getShipFullByID(id) {
    // Gets all data for a specific ship with its weapons, defenses, & weapon stats

    // Grab the ship
    const result = await pool.query('SELECT * FROM ships WHERE ship_id = $1', [id]);
    if (result.rows.length === 0) {
      throw new Error(`Ship with ID ${id} not found`);

    }
    const ship = result.rows[0];

    // Grab all supporting data
    const weaponsRes = await pool.query('SELECT * FROM weapons');
    const defensesRes = await pool.query('SELECT * FROM defenses');
    const shipWeaponsRes = await pool.query('SELECT * FROM ship_weapons WHERE ship_id = $1', [id]);
    const shipDefensesRes = await pool.query('SELECT * FROM ship_defenses WHERE ship_id = $1', [id]);

    const weaponMap = Object.fromEntries(weaponsRes.rows.map(w => [w.weapon_id, w]));
    const defenseMap = Object.fromEntries(defensesRes.rows.map(d => [d.defense_id, d]));

    // Merge weapons (exclude ship_id + usage_limit)
    const weaponsForShip = shipWeaponsRes.rows.map(sw => {
      const { usage_limit, ...weaponBase } = weaponMap[sw.weapon_id];
      const { ship_id, weapon_id, ...joinData } = sw;
      return {
        weapon_id: sw.weapon_id,
        ...weaponBase,
        ...joinData
      };
    });

    // Merge defenses (exclude ship_id)
    const defensesForShip = shipDefensesRes.rows.map(sd => {
      const { ship_id, ...joinData } = sd;
      return {
        defense_id: sd.defense_id,
        ...defenseMap[sd.defense_id],
        ...joinData
      };
    });

    return {
      ...ship,
      weapons: weaponsForShip,
      defenses: defensesForShip
    };
  }

  // ======== Get a Weapon ======== \\
  static async getWeaponByID(id) {
    // Grabs a weapon by its ID
    let result;
    try {
      result = await pool.query('SELECT * FROM weapons WHERE weapon_id = $1', [id]);
    } catch (e) {
      throw new Error(`Database query failed: ${e.message}`);
    }

    if (result.rows.length === 0) {
      throw new Error(`Weapon with ID ${id} not found`);
    }

    return (result.rows[0]);
  }

}

module.exports = AppService;
