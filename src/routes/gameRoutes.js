const express = require('express');
const fs = require('fs');
const path = require('path');
const gameRouter = express.Router();

// Serve static resources from src/public at the root
gameRouter.use(express.static(path.join(__dirname, '..', 'public')));

// Serve spectate with modifications
gameRouter.get('/game/spectate', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', 'public', 'game.html');
    let html = await fs.promises.readFile(filePath, 'utf8');

    // Modify title
    html = html.replace(
      /<title>.*?<\/title>/i,
      '<title>Star Trek Battle - Spectating Live Match</title>'
    );

    // Remove the bottom-bar
    html = html.replace(
      /<div class="bottom-bar" id="weapon-buttons"><\/div>/i,
      ''
    );

    // Replace script src if needed
/*    html = html.replace(
      /<script src="scripts\/game.js"><\/script>/i,
      '<script src="scripts/game-spectate.js"></script>'
    );*/

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send(`Failed to load spectate page`);
  }
});

module.exports = gameRouter;
