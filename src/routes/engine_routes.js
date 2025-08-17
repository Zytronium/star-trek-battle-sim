const express = require("express");
const engineRouter = express.Router();
const gameController = require("../game/gameEngine");

// engineRouter.get("/games/:id", gameController.getGame); // Get public game state
// engineRouter.get("/games/:id/events", gameController.getEvents); // Get event log for a given turn
// engineRouter.post("/game/new", gameController.postNewGame); // Create new game
engineRouter.post("/games/:id/intent", gameController.postIntent); // Submit action for current turn

module.exports = engineRouter;
