const express = require("express");
const pyRouter = express.Router();
const PyController = require("../controllers/pyController");
const debugLogs = require("../middleware/debugLogs");

pyRouter.get('/status', debugLogs, PyController.getStatus);

pyRouter.get('/greeting', debugLogs, PyController.greeting);

module.exports = pyRouter;
