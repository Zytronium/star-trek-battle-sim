const express = require('express');
const router = express.Router();
const BattleSimulator = require('../game/battleSimulator');
const { pool } = require('../config/database');

router.post('/', ... async (req, res) => {
  try {
    const { playerShipId, enemyShipId } = req.body;
    const simulator = new BattleSimulator();
    
    // Get player ship
    const playerShip = await pool.query(
      'SELECT * FROM ships WHERE ship_id = $1', 
      [playerShipId]
    );
    
    // Get enemy ship
    const enemyShip = await pool.query(
      'SELECT * FROM ships WHERE ship_id = $1', 
      [enemyShipId]
    );
    
    if (playerShip.rows.length === 0 || enemyShip.rows.length === 0) {
      return res.status(404).json({ error: 'Ship not found' });
    }
    
    const result = simulator.simulateBattle(
      playerShip.rows[0],
      enemyShip.rows[0]
    );
    
      res.json({
            outcome: result.outcome,
            logs: result.logs,
            playerShip: playerShip.rows[0],
            enemyShip: enemyShip.rows[0]
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Battle simulation failed',
      message: err.message
    });
  }
});

module.exports = router;