/*
 * API Camo attaches to the request (req) in order to be activated under
 * certain circumstances. Calling req.camo.activate() waits a random delay
 * before dropping the connection, faking a network timeout, wasting bot's
 * time, and potentially making some bots move on and stop looking for
 * vulnerabilities.
 * In app.js, put `app.use(apiCamo.camouflage);` before the routes, and
 * put `app.use(apiCamo.camo404);` after ALL routes to activate camo on
 * error 404. (This only activates when no routes were found; not  when you
 * return error 404 from inside an existing route)
 * If you wish to activate when returning status code 404 manually, replace
 * `return res.status(404).send({ error: "Not found" });` with
 * `req.camo.activate(404); return;`
 */

class APICamo {
  // Must pass in req when creating APICamo. Created once per request if this
  // middleware is in use.
  constructor(req) {
    this.req = req;
  }

  // Drop connection to make bots think something's wrong with the server
  activate(status = 0, level = 1) {
    /* Usage:
     * - req.camo.activate():
     *   - Logs "Camouflage activated." + req method, url, and IP, waits a
     *     random delay, and drops the connection.
     * - req.camo.activate(level=0):
     *   - Logs "Camouflage activated." + req method, url, and IP, and drops
     *     the connection instantly.
     * - req.camo.activate(401):
     *   - Logs "Camouflage by an unauthorized request." + req method, url,
     *     auth header, and IP, waits a random delay, and drops the connection.
     * - req.camo.activate(123, 2): (status code 123, level 2)
     *   - Logs "Camouflage activated (code 123)." + req method, url, and IP,
     *     waits a random delay (twice as long compared to level 1), and drops
     *     the connection.
     *
     * Params:
     * status: (optional) status code defining the reason for activating camo.
     *         (Status codes 401 and 404 have preset messages, all others
     *          default to `Camouflage activated. (code ${status})`
     * level: (optional) how much of the requester's time to waste before
     *        dropping connection. Random delay before dropping connection
     *        is multiplied by this number (0 is instant, 1 is default)
     */

    // Log camo activation and reason for activation if given (from status code)
    switch (status) {
      case 401:
        console.log(`Camouflage activated by an unauthorized request. ${this.req.method} ${this.req.originalUrl} | Auth: ${this.req.headers.authorization} | IP: ${this.req.ip}`);
        break;
      case 404:
        console.log(`Camouflage activated by an invalid path request. ${this.req.method} ${this.req.originalUrl} | IP: ${this.req.ip}`);
        break;
      default:
          console.log(`Camouflage activated${status === 0 ? "" : ` (code ${status})`}. ${this.req.method} ${this.req.originalUrl} | IP: ${this.req.ip}`);
          break;
    }
    // Instantly drop connection if level = 0
    if (level === 0) {
      this.req.socket.destroy();
      return;
    }
    // Calculate a random delay
    const randomDelay = (Math.random() * 25000 + 5000) * level;
    setTimeout(() => {
      // Drop connection after random delay
      this.req.socket.destroy();
    }, randomDelay);
  }
}

// Middleware that attaches API Camo to request so it can be referenced later.
function camouflage(req, res, next) {
  req.camo = new APICamo(req);
  next();
}

// Middleware that activates camo if no routes are found for the given request
function camo404(req, res, next) {
  // Activate camo
  if (req.camo)
    req.camo.activate(404);
  else // If for some reason camo has not been attached to req, fallback to this
    req.socket.destroy();
}

module.exports = { camouflage, camo404 };
