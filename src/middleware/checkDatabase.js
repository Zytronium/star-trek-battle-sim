const { pool } = require("../config/database");
module.exports = async function checkDatabase(req, res, next) {
  try {
    await pool.query('SELECT 1');
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(503).json({
      error: 'Database unavailable',
      details: debugMode ? err.message : undefined
    });
  }
}
