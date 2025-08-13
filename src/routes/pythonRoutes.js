const express = require("express");
const pyRouter = express.Router();
const auth = require("../middleware/authMiddleware");
const gameController = require("../controllers/gameController");
const debugLogs = require("../middleware/debugLogs");

pyRouter.get('/status', debugLogs, gameController.getStatus); // Get Python connection status
pyRouter.get("/games/:id", debugLogs, auth, gameController.getGame); // Get public game state
pyRouter.get("/games/:id/events", debugLogs, auth, gameController.getEvents); // Get event log for a given turn
pyRouter.post("/game/new", debugLogs, auth, gameController.postNewGame); // Create new game
pyRouter.post("/games/:id/intent", debugLogs, auth, gameController.postIntent); // Submit action for current turn

module.exports = pyRouter;
