#!/bin/node
const express = require('express');
const dotenv = require('dotenv').config({ quiet: true }); // Inject .env variables silently
const morgan = require("morgan");
const apiCamo = require("./middleware/apiCamo");
const router = require("./routes");
const {  pool } = require("./config/database");
const PORT = process.env.PORT || 5005;
const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

// Express app
const app = express();

// Trust proxy to allow logging IP addresses
app.set('trust proxy', true);

// Log requests to console
app.use(morgan("dev")); // "dev" for simpler, cleaner logs; "combined" for more detailed logs.

// Allow json requests
app.use(express.json());

// Use API Camo to protect against/mess with bots and hackers
app.use(apiCamo.camouflage);

// Serve static files from src/public
app.use(express.static(__dirname + '/public'));

// Serve API endpoints
app.use("/api", router);

// Activate API Camo when no API route found (instead of returning error 404)
app.use("/api", apiCamo.camo404);

// Run the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}${debugMode ? " in debug mode" : ""}`);
  pool.connect();
});
