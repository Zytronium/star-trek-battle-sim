const { activeGames } = require('./game/gameState');
const GameEngine = require('./game/gameEngine');

module.exports = function registerSockets(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Player joins a game (or spectates)
    socket.on('joinGame', (gameId) => {
      console.log(`Socket ${socket.id} joining game ${gameId}`);
      socket.join(`game-${gameId}`);

      // Send current state if game exists
      if (activeGames[gameId]) {
        socket.emit('gameUpdate', activeGames[gameId]);
      }
    });

    // Create a new game
    socket.on('createGame', (setup, callback) => {
      try {
        console.log("Creating new game...");
        const result = GameEngine.createGame(setup);

        if (!result.error) {
          console.log("Game created.");
          callback({ gameId: result.gameId, playerTokens: result.playerTokens });
        } else {
          console.log("Game failed to create:", result.message);
          callback({ error: result.message });
        }
      } catch (err) {
        console.error('Failed to create game:', err);
        callback({ error: err.message });
      }
    });

    // Player sends an intent
    socket.on('playerIntent', ({ gameId, intent }) => {
      try {

        // Get the current game
        const game = GameEngine.getGame(gameId);
        // Call the server-side handler directly with the full game object
        const updatedGame = GameEngine.applyIntentToGame(game, intent);
        // Broadcast the returned game state to everyone in the room
        io.to(`game-${gameId}`).emit('gameUpdate', updatedGame);
      } catch (err) {
        console.error('Failed to process intent:', err);
        socket.emit('errorMessage', err.message);
      }
    });
  });
};