const express = require("express");
const router = express.Router();
const AppController = require("../controllers/appController");
const debugLogs = require("../middleware/debugLogs");

router.get('/status', debugLogs, AppController.getStatus);          // API Status

// ============================== DATABASE ============================== \\
router.get('/database', debugLogs, AppController.getDatabase);      // Get (almost) all the database
router.get('/health', debugLogs, AppController.getHealth);          // Basic DB & API health check endpoint

// ================================ SHIPS ================================ \\
router.get('/ships', debugLogs, AppController.getShips);            // Just ships table
router.get('/ships/full', debugLogs, AppController.getShipsFull);   // Ships info combined with weapons & defenses

router.get('/ship/:id', debugLogs, AppController.getShip);          // Just ship info - no weapons or defenses
router.get('/ship/:id/full', debugLogs, AppController.getShipFull); // Full combined ship info with weapons & defenses

router.get('/boss-ships', debugLogs, AppController.getBosses);      // Get boss ships
router.get('/boss-ship/:id', debugLogs, AppController.getBoss);     // Get a boss ship

module.exports = router;
