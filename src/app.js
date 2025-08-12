#!/usr/bin/env node
require('dotenv').config({ quiet: true });
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const router = require('./routes');
const { pool, verifyConnection } = require('./config/database'); // Updated import

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

// Middleware
app.use(cors());
app.use(morgan(debugMode ? 'dev' : 'combined'));
app.use(express.json());
app.set('json spaces', 2);
app.use(express.static(__dirname + '/public'));
app.use(checkDatabase);

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