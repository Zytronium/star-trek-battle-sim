const { pool } = require("../config/database");
const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

class AppController {
  static getStatus(req, res) {
    res.status(200).send({
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  static async getHealth(req, res) {
    try {
      await pool.query('SELECT 1');
      res.send({
        status: 'healthy',
        debugMode,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).send({
        status: 'unhealthy',
        error: 'Database check failed'
      });
    }
  }

  static async getDatabase(req, res) {
    // Note: this does not get the entire database anymore, which means join tables are not returned here.
    try {
      const ships = await pool.query('SELECT * FROM ships');
      // const bossShips = await pool.query('SELECT * FROM boss_ships'); // Uncomment if we implement bosses
      const weapons = await pool.query('SELECT * FROM weapons');
      const defenses = await pool.query('SELECT * FROM defenses');
      const shipWeapons = await pool.query('SELECT * FROM ship_weapons');
      const shipDefenses = await pool.query('SELECT * FROM ship_defenses');

      res.json({
        ships: ships.rows,
        // boss_ships: bossShips.rows, // Uncomment if we implement bosses
        weapons: weapons.rows,
        defenses: defenses.rows,
        ship_weapons: shipWeapons.rows,
        ship_defenses: shipDefenses.rows
      });
    } catch (err) {
      console.error('Database query failed:', err);
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  static async getBosses(req, res) {
    try {
      const result = await pool.query('SELECT * FROM boss_ships');
      res.json(result.rows);
    } catch (err) {
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  static async getShips(req, res) {
    // Note: this does not get ship weapons or defenses
    try {
      const result = await pool.query('SELECT * FROM ships');
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Database query failed:', err);
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  static async getShipsFull(req, res) {
    // This gets all ships and combines their weapons, defenses, and unique weapons stats
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

      const ships = shipsRes.rows.map(ship => {
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

      res.status(200).json({ ships });
    } catch (err) {
      console.error('Database query failed:', err);
      res.status(500).send({ error: 'Database query failed' });
    }
  }
}

module.exports = AppController;
