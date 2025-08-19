const express = require("express");
const router = express.Router();
const AppController = require("../controllers/appController");

router.get('/status', AppController.getStatus);          // API Status

// ========================== DATABASE ========================== \\
router.get('/database', AppController.getDatabase);      // Get (almost) all the database
router.get('/health', AppController.getHealth);          // Basic DB & API health check endpoint

// ============================ SHIPS ============================ \\
router.get('/ships', AppController.getShips);            // Just ships table
router.get('/ships/full', AppController.getShipsFull);   // Ships info combined with weapons & defenses

router.get('/ship/:id', AppController.getShip);          // Just ship info - no weapons or defenses
router.get('/ship/:id/full', AppController.getShipFull); // Full combined ship info with weapons & defenses

router.get('/boss-ships', AppController.getBosses);      // Get all boss ships
router.get('/boss-ship/:id', AppController.getBoss);     // Get a boss ship

router.get('/shipImg/:id', AppController.getShipImage);  // Get a ship image src

// =========================== WEAPONS =========================== \\
router.get('/weapon/:id', AppController.getWeapon);      // Get a weapon
// router.get('/weapons', AppController.getWeapons);        // Get all weapons


module.exports = router;
