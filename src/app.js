#!/usr/bin/env node
require('dotenv').config({ quiet: true });
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const router = require('./routes');
const { pool, verifyConnection } = require('./config/database');
const BattleSimulator = require('./game/battleSimulator');

const PORT = process.env.PORT || 5005;
const debugMode = process.env.DEBUG?.toLowerCase() === 'true';
const battleRoutes = require('./routes/battleRoutes');

// Express app
const app = express();

// Trust proxy to allow logging IP addresses
app.set('trust proxy', true);

// Database health check middleware
async function checkDatabase(req, res, next) {
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

// Middleware
app.use(cors());
app.use(morgan(debugMode ? 'dev' : 'combined'));
app.use(express.json());
app.set('json spaces', 2);
app.use(express.static(__dirname + '/public'));
app.use(checkDatabase);
app.use('/api/battle', battleRoutes);

// API routes
app.use('/api', router);

// Basic health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      debugMode,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database check failed'
    });
  }
});

// Database info endpoint
app.get('/api/database', async (req, res) => {
  try {
    const ships = await pool.query('SELECT * FROM ships');
    const bossShips = await pool.query('SELECT * FROM boss_ships');
    const weapons = await pool.query('SELECT * FROM weapons');
    const defenses = await pool.query('SELECT * FROM defenses');
    
    res.json({
      status: 'success',
      ships: ships.rows,
      bossShips: bossShips.rows,
      weapons: weapons.rows,
      defenses: defenses.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Fixed endpoints
app.get('/api/ships', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ships');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/boss-ships', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM boss_ships');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Consolidated battle simulation endpoint
app.post('/api/simulate-battle', async (req, res) => {
  try {
    const { playerShipId, enemyShipId } = req.body;
    
    // Get player ship
    const playerShip = await pool.query(
      'SELECT * FROM ships WHERE ship_id = $1', 
      [playerShipId]
    );
    
    // Get enemy ship
    const enemyShip = await pool.query(
      'SELECT * FROM boss_ships WHERE ship_id = $1', 
      [enemyShipId]
    );
    
    if (playerShip.rows.length === 0 || enemyShip.rows.length === 0) {
      return res.status(404).json({ error: 'Ship not found' });
    }
    
    // Add validation
    const player = playerShip.rows[0];
    const enemy = enemyShip.rows[0];
    
    if (!player.shield_strength || !enemy.shield_strength) {
      throw new Error('Missing ship stats in database records');
    }

    // Simulate battle
    const simulator = new BattleSimulator();
    const result = simulator.simulateBattle(player, enemy);
    
    res.json({
      result: result.outcome,
      logs: result.logs,
      playerShip: player,
      enemyShip: enemy
    });
  } catch (err) {
    console.error('Battle simulation error:', err);
    res.status(500).json({ 
      error: 'Battle simulation failed',
      message: debugMode ? err.message : 'Internal server error',
      stack: debugMode ? err.stack : undefined
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: debugMode ? err.message : undefined
  });
});

async function startServer() {
  try {
    // Enhanced connection test with verification
    const isConnected = await verifyConnection();
    if (!isConnected) {
      throw new Error('Could not establish database connection');
    }
    console.log('🔌 Database connection verified');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}${debugMode ? ' in debug mode' : ''}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);

      if (debugMode) {
        console.log('🛣️ Available API routes:');
        router.stack.forEach(layer => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
            console.log(`- ${methods} api${layer.route.path}`);
          }
        });
      }
    });

  } catch (err) {
    console.error('💥 Failed to start server:', err.message);
    console.error('Please verify:');
    console.error('1. Database server is running');
    console.error('2. Database and user exist (check .env settings)');
    console.error('3. Connection parameters are correct');
    console.error(`4. DB_PASSWORD is properly set: ${process.env.DB_PASSWORD ? 'Exists' : 'MISSING'}`);
    process.exit(1);
  }
}

// Start the application
startServer();

// Cleanup on exit
process.on('SIGTERM', async () => {
  console.log('SIGTERM received - shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received - shutting down gracefully');
  await pool.end();
  process.exit(0);
});