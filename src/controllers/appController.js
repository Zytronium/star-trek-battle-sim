const { pool } = require("../config/database");

class AppController {
  static getStatus(req, res) {
    res.status(200).send({ status: "OK" });
  }

  static async getDatabase(req, res) {
    try {
      // Step 1: Get all base tables, views, and materialized views
      const objectsResult = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        
        UNION

        SELECT matviewname AS table_name
        FROM pg_matviews
        WHERE schemaname = 'public'
      `);

      const allData = {};

      // Step 2: Query all objects in parallel
      await Promise.all(objectsResult.rows.map(async ({ table_name }) => {
        try {
          const result = await pool.query(`SELECT * FROM "${table_name}"`);
          allData[table_name] = result.rows;
        } catch (err) {
          // In case a view/materialized view fails (permissions, etc.)
          allData[table_name] = { error: err.message };
        }
      }));

      // Step 3: Return everything
      res.status(200).json(allData);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  }
}

module.exports = AppController;
