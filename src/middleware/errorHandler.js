module.exports = function errorHandler(err, req, res, next) {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.DEBUG === 'true' ? err.message : undefined
  });
}

