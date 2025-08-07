#!/bin/node
const express = require('express');
const dotenv = require('dotenv').config({ quiet: true }); // Inject .env variables silently
const morgan = require("morgan");
const router = require("./routes");
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

app.use(router);

// Run the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}${debugMode ? " in debug mode" : ""}`);
});
