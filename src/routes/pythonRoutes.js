const express = require("express");
const pyRouter = express.Router();
const gameController = require("../controllers/gameController");
const debugLogs = require("../middleware/debugLogs");

pyRouter.get('/status', debugLogs, gameController.getStatus);

module.exports = pyRouter;
