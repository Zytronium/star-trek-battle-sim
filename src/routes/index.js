const express = require("express");
const router = express.Router();
const AppController = require("../controllers/appController");
const debugLogs = require("../middleware/debugLogs");

router.get('/status', debugLogs, AppController.getStatus);

module.exports = router;
