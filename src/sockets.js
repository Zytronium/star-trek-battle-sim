const { activeGames } = require('./game/gameState');
const GameEngine = require('./game/gameEngine');

const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

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

    const cpuProcessingLock = new Set();

    // Player sends an intent
    socket.on('playerIntent', async ({ gameId, intent }) => {
      try {
        // Retrieve the current game from the game engine
        const game = GameEngine.getGame(gameId);
        if (!game)
          throw new Error(`Game ${gameId} not found.`);

        // Reject intents if CPU is still processing (except on turn 1)
        if (cpuProcessingLock.has(gameId)) {
          return socket.emit('errorMessage', 'Please wait for the CPU to take its turn before submitting another action.');
        }

        // Process the player's turn intent
        const updatedGame = await GameEngine.processTurnIntent(game, intent);

        // Lock CPU processing for this game if player turn succeeded
        if (game.type.toUpperCase() === "PLAYER V AI") {
          cpuProcessingLock.add(gameId);
        }

        // Broadcast the updated game state to all clients in the room
        io.to(`game-${gameId}`).emit('gameUpdate', updatedGame);

        // If the game is Player vs AI, process the CPU turn
        if (game.type.toUpperCase() === "PLAYER V AI") {
          try {
            const cpuStart = Date.now();

            // Generate the CPU's intent based on the current game state
            const cpuIntent = await GameEngine.getAiIntent(gameId, "COM1");

            // Process the CPU's turn intent, updating the game state again
            const nextGameUpdate = await GameEngine.processTurnIntent(game, cpuIntent);

            const cpuElapsed = Date.now() - cpuStart;
            console.log(`CPU intent generation and processing took ${cpuElapsed} ms`);

            // Calculate delay to ensure at least 2 seconds after player update
            const delay = Math.max(2000 - cpuElapsed, 0);

            // Wait before sending CPU update
            await new Promise(resolve => setTimeout(resolve, delay));

            // Broadcast the updated game state after the CPU turn
            io.to(`game-${gameId}`).emit('gameUpdate', nextGameUpdate);

          } catch (cpuError) {
            // Handle errors specifically from CPU turn processing
            console.error('Failed to process CPU turn:', cpuError);
            socket.emit('errorMessage', debugMode ? cpuError : cpuError.message);
          } finally {
            // Unlock CPU processing for this game so player can act next
            cpuProcessingLock.delete(gameId);
          }
        }

      } catch (playerError) {
        // Handle errors from the player's turn processing
        console.error('Failed to process player intent:', playerError);
        socket.emit('errorMessage', debugMode ? playerError : playerError.message);
      }
    });
  });
};
