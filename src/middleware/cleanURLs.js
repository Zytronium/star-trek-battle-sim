const path = require('path');
const fs = require('fs');

function clean_HTML_URLs(publicDir) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    // Helper: raw query string (e.g., "?a=1&b=2"), safe for mounted paths
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const base = req.baseUrl || '';

    // Redirect /index or /index.html to /  (& preserve query params)
    if (req.path === '/index' || req.path === '/index.html') {
      return res.redirect(301, `${base}/${qs}`);
    }

    const ext = path.extname(req.path);

    // If request has .html extension, redirect to clean URL if file exists (preserve query)
    if (ext === '.html') {
      const filePath = path.join(publicDir, req.path);
      return fs.access(filePath, fs.constants.F_OK, err => {
        if (err) return next(); // If file doesn't exist, continue
        const cleanPath = req.path.replace(/\.html$/, '') || '/';
        return res.redirect(301, `${base}${cleanPath}${qs}`);
      });
    }

    // If request has no extension, try serving <name>.html (no redirect; URL stays as-is)
    if (!ext) {
      const urlPath = req.path.endsWith('/') ? req.path + 'index.html' : req.path + '.html';
      const filePath = path.join(publicDir, urlPath);

      return fs.access(filePath, fs.constants.F_OK, err => {
        if (err) return next(); // If file doesn't exist, continue
        res.sendFile(filePath);
      });
    }

    // otherwise, let static middleware handle it
    next();
  };
}

module.exports = clean_HTML_URLs;
