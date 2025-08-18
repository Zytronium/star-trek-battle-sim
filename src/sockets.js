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
    socket.on('createGame', async (setup, callback) => {
      try {
        console.log("Creating new game...");
        const result = await GameEngine.createGame(setup);

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
    socket.on('playerIntent', async ({ gameId, intent }) => {
      try {
        // Get the current game
        const game = GameEngine.getGame(gameId);
        if (!game)
          throw new Error(`Game ${gameId} not found.`);

        // Process player turn intent
        await GameEngine.processTurnIntent(game, intent)
          .then(async (updatedGame) => {
            // Broadcast the returned game state to everyone in the room
            io.to(`game-${gameId}`).emit('gameUpdate', updatedGame);

            // Process CPU turn if Player V AI
            if (game.type.toUpperCase() === "PLAYER V AI") {
              await GameEngine.getAiIntent(gameId, "COM1") // Get CPU intent
                .then(async (AiIntent) => {
                  await GameEngine.processTurnIntent(game, AiIntent) // Process CPU turn intent
                    .then((nextGameUpdate) => {
                      // todo
                    })
                })
            }
          })
          .catch(e => {
            console.error('Failed to process intent:', e.message);
            socket.emit('errorMessage', e.message);
          });
      } catch (err) {
        console.error('Failed to process intent:', err.message);
        socket.emit('errorMessage', err.message);
      }
    });
  });
};