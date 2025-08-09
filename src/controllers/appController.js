const { pool } = require("../config/database");

class AppController {
  static getStatus(req, res) {
    res.status(200).send({ status: "OK" });
  }
  static async getDatabase(req, res) {
    try {
      const spacecraftResult = await pool.query('SELECT * FROM spacecrafts');
      const weaponsResult = await pool.query('SELECT * FROM weapons');

      res.status(200).json({
        spacecrafts: spacecraftResult.rows,
        weapons: weaponsResult.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  }
}

module.exports = AppController;
