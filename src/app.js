#!/usr/bin/env node
const express = require('express');
const dotenv = require('dotenv').config({ quiet: true });
const morgan = require('morgan');
const cors = require('cors');
const router = require('./routes');
const { pool, verifyConnection } = require('./config/database');
const { initializeDatabase: initializeETLData } = require('../etl/etlscript'); // Renamed import

const PORT = process.env.PORT || 5005;
const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

// Express app
const app = express();

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

// Trust proxy to allow logging IP addresses
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(morgan(debugMode ? 'dev' : 'combined'));
app.use(express.json());
app.set('json spaces', 2);
app.use(express.static(__dirname + '/public'));
app.use(checkDatabase);

// API routes
app.use('/api', router);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT COUNT(*) FROM ships');
    res.json({
      status: 'healthy',
      ships: dbResult.rows[0].count,
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

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: debugMode ? err.message : undefined
  });
});

async function setupDatabase() {  // Renamed this function
  const { createTables } = require('./config/database');
  
  try {
    console.log('🛠️ Creating database tables...');
    await createTables();
    
    console.log('📦 Loading initial data...');
    await initializeETLData();  // Using the renamed import
    
    console.log('✅ Database initialization complete');
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    throw err;
  }
}

async function startServer() {
  try {
    // Verify database connection
    await pool.query('SELECT 1');
    console.log('🔌 Database connection established');

    // Initialize database if requested
    if (process.env.INIT_DB === 'true') {
      await setupDatabase();  // Using the renamed function
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}${debugMode ? ' in debug mode' : ''}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      
      if (debugMode) {
        console.log('🛣️ Available API routes:');
        router.stack.forEach(layer => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
            console.log(`- ${methods} ${layer.route.path}`);
          }
        });
      }
    });
  } catch (err) {
    console.error('💥 Failed to start server:', err);
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