const express = require("express");
const router = express.Router();
const AppController = require("../controllers/appController");
const debugLogs = require("../middleware/debugLogs");

router.get('/status', debugLogs, AppController.getStatus);

router.get('/database', debugLogs, AppController.getDatabase);

module.exports = router;
