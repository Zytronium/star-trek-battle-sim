const { pool } = require("../config/database");

class AppController {
  static getStatus(req, res) {
    res.status(200).send({
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
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
      res.status(500).json({ error: 'Database query failed' });
    }
  }

  static async getShips(req, res) {
    // Note: this does not get ship weapons or defenses
    try {
      const result = await pool.query('SELECT * FROM ships');
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Database query failed:', err);
      res.status(500).json({ error: 'Database query failed' });
    }
  }
}

module.exports = AppController;
