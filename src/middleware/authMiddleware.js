const crypto = require("crypto");

module.exports = function(req, res, next) {
  console.log("Authentication middleware not implemented yet. Skipping auth.");
  next();
}
