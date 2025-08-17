module.exports = function(req, res, next) {
  if (process.env.DEBUG?.toLowerCase() === 'true') {
    console.log(`Receiving request for ${req.method} ${req.originalUrl}...`);
    // Put any debug logs here
    const randomNumGen = Math.floor(Math.random() * 25);
    if (randomNumGen === 0) {
      console.log("Never gonna give you up!"); // hehe
    }
  }
  next();
}
