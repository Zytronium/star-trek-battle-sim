#!/usr/bin/env node
require('dotenv').config({ quiet: true });
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const router = require('./routes');
const gameRouter = require('./routes/gameRoutes');
const errorHandler = require('./middleware/errorHandler');
const checkDatabase = require("./middleware/checkDatabase");
const cleanHtmlUrls = require("./middleware/cleanURLs");
const debugLogs = require('./middleware/debugLogs');
const { pool, verifyConnection } = require('./config/database');
const http = require('http');
const { Server } = require('socket.io');
const registerSockets = require('./sockets');
const { setIO } = require('./game/gameState');

const PORT = process.env.PORT || 5005;
const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

// Express app
const app = express();

// Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', //todo: set this from env variable: this is the website domain (I think)
    methods: ['GET', 'POST']
  }
});

// Create and register web sockets
setIO(io);
registerSockets(io);

// Trust proxy to allow logging IP addresses
app.set('trust proxy', true);

// ================ Middleware ================ \\
app.use(cors());                                 // Enable CORS
app.use(morgan(debugMode ? 'dev' : 'combined')); // Log requests to console
app.use(express.json());                         // Parse JSON
app.use(express.urlencoded({ extended: true })); // Auto-parse JSON body
app.set('json spaces', 2);                       // Pretty print JSON
app.use(debugLogs);                              // Debug logs middleware
app.use('/api', checkDatabase);                  // Database health check middleware
app.use(cleanHtmlUrls(__dirname + '/public'));   // Serve pages to URLs without ".html" (i.e. /game instead of /game.html)
app.use(express.static(__dirname + '/public'));  // Serve static files

// ================== Routes ================== \\
app.use('/api', router);  // API routes
app.use('', gameRouter);  // Special game routes (/game/spectate)

// ============== Error Handling ============== \\
app.use(errorHandler);  // MUST be last

async function startServer() {
  try {
    // Enhanced connection test with verification
    const isConnected = await verifyConnection();
    if (!isConnected) {
      throw new Error('Could not establish database connection');
    }
    console.log('🔌 Database connection verified');

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}${debugMode ? ' in debug mode' : ''}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);

      if (debugMode) {
        console.log('🛣️ Available API routes:');
        router.stack.forEach(layer => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
            console.log(`- ${methods} api${layer.route.path}`);
          }
        });
        console.log('-------------------------------');
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

async function shutdown(signal) {
  console.log(`${signal} received - shutting down gracefully`);
  await pool.end();
  process.exit(0);
}

// Start the application
startServer();

// Cleanup on exit
['SIGTERM', 'SIGINT'].forEach(sig => process.on(sig, () => shutdown(sig)));
