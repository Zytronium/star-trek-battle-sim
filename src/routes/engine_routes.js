const express = require("express");
const engineRouter = express.Router();
const auth = require("../middleware/authMiddleware");
const gameController = require("../controllers/gameController");
const debugLogs = require("../middleware/debugLogs");

engineRouter.get('/status', debugLogs, gameController.getStatus); // Get Python connection status
engineRouter.get("/games/:id", debugLogs, auth, gameController.getGame); // Get public game state
engineRouter.get("/games/:id/events", debugLogs, auth, gameController.getEvents); // Get event log for a given turn
engineRouter.post("/game/new", debugLogs, auth, gameController.postNewGame); // Create new game
engineRouter.post("/games/:id/intent", debugLogs, auth, gameController.postIntent); // Submit action for current turn

module.exports = engineRouter;
