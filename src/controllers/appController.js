const { pool } = require("../config/database");
const AppService = require("./appService");
const { activeGames, waitingRooms } = require("../game/gameState");
const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

class AppController {
  // GET /api/status
  static getStatus(req, res) {
    res.status(200).send({
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  // GET /api/rooms (temp)
  static getWaitingRooms(req, res) {
    res.status(200).json(waitingRooms);
  }
  // GET /api/games (temp)
  static getGames(req, res) {
    res.status(200).json(activeGames);
  }

  // GET /api/health
  static async getHealth(req, res) {
    try {
      await pool.query('SELECT 1');
      res.send({
        status: 'healthy',
        debugMode,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).send({
        status: 'unhealthy',
        error: 'Database check failed',
        debugMode,
        timestamp: new Date().toISOString()
      });
    }
  }

  // GET /api/database
  static async getDatabase(req, res) {
    try {
      const data = await AppService.getDatabase();
      res.status(200).json(data);
    } catch (err) {
      console.error('Database query failed:', err);
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  // GET /api/boss-ships
  static async getBosses(req, res) {
    try {
      const data = AppService.getBosses()
      res.status(200).json(data);
    } catch (err) {
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  // GET /api/boss-ship/:id
  static async getBoss(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send("Param 'id' is required");
    }
    if (isNaN(id)) {
      return res.status(400).send("Param 'id' is invalid");
    }
    try {
      const data = await AppService.getBossByID(id);
      res.status(200).json(data);
    } catch (err) {
      if (err.message === `Boss Ship with ID ${id} not found`) {
        return res.status(404).json({ error: 'Boss Ship not found' });
      }
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  // GET /api/ships
  static async getShips(req, res) {
    try {
      const data = await AppService.getShips();
      res.status(200).json(data);
    } catch (err) {
      console.error('Database query failed:', err);
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  // GET /api/ships/full
  static async getShipsFull(req, res) {
    try {
      const data = await AppService.getShipsFull();
      res.status(200).json(data);
    } catch (err) {
      console.error('Database query failed:', err);
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  // GET /api/ship/:id
  static async getShip(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send("Param 'id' is required");
    }
    if (isNaN(id)) {
      return res.status(400).send("Param 'id' is invalid");
    }
    try {
      const data = await AppService.getShipByID(id);
      res.status(200).json(data);
    } catch (err) {
      if (err.message === `Ship with ID ${id} not found`) {
        return res.status(404).json({ error: 'Ship not found' });
      }
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  // GET /api/ship/:id/full
  static async getShipFull(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send("Param 'id' is required");
    }
    if (isNaN(id)) {
      return res.status(400).send("Param 'id' is invalid");
    }
    try {
      const data = await AppService.getShipFullByID(id);
      res.status(200).json(data);
    } catch (err) {
      if (err.message === `Ship with ID ${id} not found`) {
        return res.status(404).json({ error: 'Ship not found' });
      }
      console.error('Database query failed:', err);
      res.status(500).send({ error: 'Database query failed' });
    }
  }


  // GET /api/weapon/:id
  static async getWeapon(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send("Param 'id' is required");
    }
    if (isNaN(id)) {
      return res.status(400).send("Param 'id' is invalid");
    }
    try {
      const data = await AppService.getWeaponByID(id);
      res.status(200).json(data);
    } catch (err) {
      if (err.message === `Weapon with ID ${id} not found`) {
        return res.status(404).json({ error: 'Weapon not found' });
      }
      res.status(500).send({ error: 'Database query failed' });
    }
  }

  //  GET /api/shipImg/:id  Why is this comment orange
  static async getShipImage(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send("Param 'id'' is required")
    }
    if (isNaN(id)) {
      return res.status(400).send("Param 'id' is invalid");
    }
    try {
      const img = await AppService.getShipImageSRC(id);
      res.status(200).send({ status: 'success', src: img });
    } catch (err) {
      if (err.message === `Ship with ID ${id} not found`) {
        return res.status(404).json({ error: 'Ship not found' });
      }
      res.status(500).send({ error: 'Database query failed' });
    }
  }


}

module.exports = AppController;
