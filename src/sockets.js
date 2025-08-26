const { activeGames, waitingRooms, setIO } = require('./game/gameState');
const GameEngine = require('./game/gameEngine');

const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

module.exports = function registerSockets(io) {
  // Ensure other modules that expect getIO() have the socket server reference
  try {
    if (typeof setIO === 'function') {
      setIO(io);
    } else {
      console.warn('gameState.setIO not available; GameEngine.getIO() may fail.');
    }
  } catch (e) {
    console.warn('Failed to set IO on gameState:', e);
  }

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Helper: produce safe copy of waitingRoom (remove tokens)
    function sanitizeWaitingRoom(room) {
      if (!room) return null;
      return {
        gamePin: room.gamePin,
        spectatePin: room.spectatePin,
        spectateVis: room.spectateVis,
        joinVis: room.joinVis,
        // p1 and p2 will include non-secret metadata only
        p1: room.p1 ? {
          ship: room.p1.ship,
          ready: !!room.p1.ready,
          connected: !!room.p1.connected,
          // include a short token fingerprint so clients can identify their own slot without receiving the token
          token_hidden_id: String(room.p1.token || '').slice(0, 6)
        } : null,
        p2: room.p2 ? {
          ship: room.p2.ship,
          ready: !!room.p2.ready,
          connected: !!room.p2.connected,
          token_hidden_id: String(room.p2.token || '').slice(0, 6)
        } : null
      };
    }

    // Helper: find which slot corresponds to a token (server-side full-token comparison)
    function getSlotForToken(room, token) {
      if (!room) return null;
      if (room.p1 && room.p1.token === token) return 'p1';
      if (room.p2 && room.p2.token === token) return 'p2';
      return null;
    }

    // --- create waiting room ---
    socket.on('createWaitingRoom', async (payload, callback) => {
      try {
        const { spectateVis = 'PUBLIC', joinVis = 'PUBLIC', p1Ship, playerToken } = payload || {};

        // Prevent a socket from creating a new waiting room while it's already associated with one
        if (socket.data.gamePin) {
          return callback && callback({ error: 'You are already in a waiting room. Leave it first to create a new one.' });
        }

        // create room using GameEngine helper
        const waitingRoom = await GameEngine.createWaitingRoom(spectateVis, joinVis, p1Ship, playerToken);

        // IMPORTANT: GameEngine.createWaitingRoom may return an existing host room
        // (auto-match). The caller might be p1 (host) or p2 (joined guest). Determine
        // the correct slot for this player by comparing the stored tokens.
        const slotForCaller = getSlotForToken(waitingRoom, playerToken) || 'p1';

        // join socket.io room for updates for the correct gamePin (use the returned room.gamePin)
        const sockRoom = `waiting-${waitingRoom.gamePin}`;
        socket.join(sockRoom);

        // mark socket's association with correct slot
        socket.data.gamePin = waitingRoom.gamePin;
        socket.data.playerSlot = slotForCaller;
        socket.data.playerToken = playerToken;

        // The GameEngine returns a waitingRoom that includes the p1.token (server-only). Do NOT send token to clients.
        // But we'll return a sanitized copy to clients that includes token_hidden_id fingerprints.
        const publicRoom = sanitizeWaitingRoom(waitingRoom);

        // send callback containing the sanitized room and pins
        if (typeof callback === 'function') {
          callback({ gamePin: waitingRoom.gamePin, spectatePin: waitingRoom.spectatePin, room: publicRoom });
        }

        // Broadcast to the room that it was created/updated
        io.to(sockRoom).emit('waitingRoomUpdated', publicRoom);

      } catch (err) {
        console.error('createWaitingRoom error', debugMode ? err : err.message);
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    // --- join waiting room ---
    socket.on('joinWaitingRoom', (payload, callback) => {
      try {
        const { gamePin, playerToken, p2Ship } = payload || {};

        // Prevent joining if this socket is already associated with a different waiting room
        if (socket.data.gamePin && socket.data.gamePin !== gamePin) {
          return callback && callback({ error: 'You are already in a waiting room. Leave it first to join another.' });
        }

        const room = waitingRooms[gamePin];
        if (!room) {
          return callback && callback({ error: 'Waiting room not found' });
        }

        if (room.p2) {
          // Already has a second player
          return callback && callback({ error: 'Room already full' });
        }

        // Attach p2 — store the token server-side ONLY
        room.p2 = {
          ship: p2Ship,
          token: playerToken,
          ready: false,
          connected: true
        };

        // join socket to the room
        const sockRoom = `waiting-${gamePin}`;
        socket.join(sockRoom);
        socket.data.gamePin = gamePin;
        socket.data.playerSlot = 'p2';
        socket.data.playerToken = playerToken;

        // Build sanitized copy and broadcast
        const publicRoom = sanitizeWaitingRoom(room);

        // If both players present we hide the join pin in the public representation (client will remove join-pin)
        // NOTE: sanitizeWaitingRoom already returns gamePin — client will hide it when p2 exists

        // Respond to the joining client with the sanitized room and pins
        callback && callback({ room: publicRoom, spectatePin: room.spectatePin });

        io.to(sockRoom).emit('waitingRoomUpdated', publicRoom);
      } catch (err) {
        console.error('joinWaitingRoom error', debugMode ? err : err.message);
        callback && callback({ error: err.message });
      }
    });

    // --- leave waiting room ---
    socket.on('leaveWaitingRoom', (payload, callback) => {
      try {
        // Prefer socket.data.gamePin if available; otherwise accept payload.gamePin
        const pin = socket.data.gamePin || (payload && payload.gamePin);
        if (!pin) {
          return callback && callback({ error: 'No waiting room specified.' });
        }
        const room = waitingRooms[pin];
        if (!room) {
          // Nothing to do — maybe already cleaned up
          return callback && callback({ ok: true });
        }

        // Determine which slot this socket corresponds to (server-side token check)
        const slot = socket.data.playerSlot || getSlotForToken(room, socket.data.playerToken);
        if (!slot || !room[slot]) {
          return callback && callback({ error: 'You are not a participant in that waiting room.' });
        }

        // Remove player's presence from the room
        // If the leaving slot is the host (p1) and p2 exists, promote p2 -> p1.
        const leavingSlot = slot;
        if (leavingSlot === 'p1') {
          if (room.p2) {
            // promote p2 to p1
            room.p1 = {
              ship: room.p2.ship,
              token: room.p2.token,
              ready: !!room.p2.ready,
              connected: !!room.p2.connected
            };
            delete room.p2;
            // Note: socket.data for the other client isn't changed here; their client will remap to p1 via token_hidden_id on the next sanitized broadcast.
          } else {
            // no other player — remove the p1 entry
            delete room.p1;
          }
        } else {
          // leaving p2 (or other) — remove p2
          delete room[leavingSlot];
        }

        // Ensure socket leaves the socket.io room and clear socket-associated fields
        try { socket.leave(`waiting-${pin}`); } catch (e) {}
        socket.data.gamePin = null;
        socket.data.playerSlot = null;
        socket.data.playerToken = null;

        callback && callback({ ok: true });
      } catch (err) {
        console.error('leaveWaitingRoom error', debugMode ? err : err.message);
        callback && callback({ error: err.message });
      }
    });

    // --- ship selection broadcast (player updates their ship) ---
    socket.on('selectShip', (payload) => {
      try {
        const { gamePin, playerToken, ship } = payload || {};
        const room = waitingRooms[gamePin];
        if (!room) return socket.emit('errorMessage', 'Waiting room not found');

        const slot = getSlotForToken(room, playerToken);
        if (!slot) return socket.emit('errorMessage', 'Invalid player token');

        // Update server-side room state (store full ship object to show on both clients)
        room[slot].ship = ship;
        room[slot].connected = true;

        // Broadcast sanitized update
        io.to(`waiting-${gamePin}`).emit('waitingRoomUpdated', sanitizeWaitingRoom(room));
      } catch (err) {
        console.error('selectShip error', debugMode ? err : err.message);
        socket.emit('errorMessage', err.message);
      }
    });

    // --- toggle ready ---
    socket.on('toggleReady', (payload, callback) => {
      try {
        const { gamePin, playerToken, ready } = payload || {};
        const room = waitingRooms[gamePin];
        if (!room) return callback && callback({ error: 'Waiting room not found' });

        const slot = getSlotForToken(room, playerToken);
        if (!slot) return callback && callback({ error: 'Invalid player token' });

        room[slot].ready = !!ready;

        // Broadcast sanitized update
        const publicRoom = sanitizeWaitingRoom(room);
        io.to(`waiting-${gamePin}`).emit('waitingRoomUpdated', publicRoom);

        // If both players present and both ready, emit bothReady
        if (room.p1 && room.p2 && room.p1.ready && room.p2.ready) {
          io.to(`waiting-${gamePin}`).emit('bothReady', { gamePin: room.gamePin });
        }

        callback && callback({ ok: true });
      } catch (err) {
        console.error('toggleReady error', debugMode ? err : err.message);
        callback && callback({ error: err.message });
      }
    });

    // --- start game (host-only action) ---
    // This is the server-side verification gate: only allow start if both players exist and both ready.
    socket.on('startGame', async (payload, callback) => {
      try {
        const { gamePin, playerToken } = payload || {};
        const room = waitingRooms[gamePin];
        if (!room) return callback && callback({ error: 'Waiting room not found' });

        // Verify caller is host (p1)
        if (!room.p1 || room.p1.token !== playerToken) {
          return callback && callback({ error: 'Only the host (p1) can start the game' });
        }

        // Verify both players present and both ready
        if (!room.p2) return callback && callback({ error: 'Waiting for opponent' });
        if (!room.p1.ready || !room.p2.ready) {
          return callback && callback({ error: 'Both players must be ready' });
        }

        // Build ships array in the format expected by GameEngine.createGame
        const ships = [
          {
            ship_id: room.p1.ship.ship_id,
            pilot: 'P1',
            is_boss: false,
          },
          {
            ship_id: room.p2.ship.ship_id,
            pilot: 'P2',
            is_boss: false,
          },
        ];

        // Call GameEngine to set up the game
        const result = await GameEngine.createGame(
          'PLAYER V PLAYER',
          ships,
          {
            P1: room.p1.token,
            P2: room.p2.token
          },
          room.spectatePin,
          room.spectateVis.toUpperCase() === 'PRIVATE'
        );

        if (result.error || !result.success) {
          return callback && callback({ error: result.message || 'Failed to create game' });
        }

        const { gameId } = result;

        // cleanup waiting room
        delete waitingRooms[gamePin];

        // inform clients that game is starting and give them the gameId
        io.to(`waiting-${gamePin}`).emit('gameStarted', { gameId });

        // optionally join sockets to `game-${gameId}` if desired
        callback && callback({ ok: true, gameId });
      } catch (err) {
        console.error('startGame error', debugMode ? err : err.message);
        callback && callback({ error: err.message });
      }
    });


    // Handle disconnects — set connected=false for that player's slot and broadcast update
    socket.on('disconnect', () => {
      try {
        const pin = socket.data.gamePin;
        if (!pin) return;
        const room = waitingRooms[pin];
        if (!room) return;
        if (socket.data.playerSlot && room[socket.data.playerSlot]) {
          room[socket.data.playerSlot].connected = false;
          // broadcast updated state
          io.to(`waiting-${pin}`).emit('waitingRoomUpdated', sanitizeWaitingRoom(room));
        }
      } catch (err) {
        console.warn('disconnect handling error', err);
      }
    });

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
        const result = await GameEngine.createGame(setup.type, setup.ships, { "P1": setup.playerToken });

        if (!result.error) {
          console.log("Game created.");
          callback({ gameId: result.gameId });
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
    socket.on('playerIntent', async ({ gameId, intent, token }) => {
      try {
        // Retrieve the current game from the game engine
        const game = GameEngine.getGame(gameId);
        if (!game) {
          console.warn(`[WARNING] Invalid intent from socket ${socket.id}: Game ${gameId} not found.`);
          return socket.emit('errorMessage', 'Game not found or no longer active.');
        }

        // Reject intents if game is already over
        if (game.winner) {
          console.info(`[GAME] Socket ${socket.id} tried to act in finished game ${gameId}. Winner: ${game.winner}`);
          endGame(gameId);
          return socket.emit('errorMessage', `This game is already over. Winner: ${game.winner}`);
        }

        // Reject intents if CPU is still processing (except on turn 1)
        if (cpuProcessingLock.has(gameId)) {
          console.warn(`[SECURITY] Socket ${socket.id} tried to act while CPU was processing in game ${gameId}.`);
          return socket.emit('errorMessage', 'Please wait for the CPU to finish its turn.');
        }

        // Validate attacker
        const attacker = (intent.attacker || "").toUpperCase();
        const attackerShip = game.ships.find(s => s.pilot.toUpperCase() === attacker);

        if (!attackerShip || !attacker.startsWith("P")) {
          console.warn(`[SECURITY] Invalid attacker from socket ${socket.id} in game ${gameId}: ${attacker}`);
          return socket.emit('errorMessage', 'Invalid action.');
        }

        // Prevent controlling CPU ships explicitly
        if (attacker.startsWith("COM")) {
          console.warn(`[SECURITY] Socket ${socket.id} tried to act as CPU ship in game ${gameId}.`);
          return socket.emit('errorMessage', 'Invalid action.');
        }

        // Validate target
        const target = (intent.target || "").toUpperCase();
        const targetShip = game.ships.find(s => s.pilot.toUpperCase() === target);

        if (!targetShip) {
          console.warn(`[SECURITY] Invalid target from socket ${socket.id} in game ${gameId}: ${target}`);
          return socket.emit('errorMessage', 'Invalid target specified.');
        }

        if (attacker === target) {
          console.warn(`[SECURITY] Socket ${socket.id} attempted self-targeting in game ${gameId}. Attacker/Target: ${attacker}`);
          return socket.emit('errorMessage', 'You cannot fire on yourself.');
        }

        // Process the player's turn intent
        const updatedGame = await GameEngine.processTurnIntent(game, intent, token);

        // Lock CPU processing for this game if player turn succeeded
        if (game.type.toUpperCase() === "PLAYER V AI") {
          cpuProcessingLock.add(gameId);
        }

        // Broadcast the updated game state to all clients in the room
        io.to(`game-${gameId}`).emit('gameUpdate', updatedGame);

        // If there's no winner yet and the game is Player vs AI, process the CPU turn
        if (!updatedGame.winner && game.type.toUpperCase() === "PLAYER V AI") {
          try {
            const cpuStart = Date.now();
            const cpuIntent = await GameEngine.getAiIntent(gameId, "COM1");
            const nextGameUpdate = await GameEngine.processTurnIntent(game, cpuIntent);
            const cpuElapsed = Date.now() - cpuStart;
            console.log(`CPU intent generation and processing took ${cpuElapsed} ms`);

            // Wait before sending CPU update
            const delay = Math.max(2000 - cpuElapsed, 0);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Broadcast the updated game state after the CPU turn
            io.to(`game-${gameId}`).emit('gameUpdate', nextGameUpdate);
          } catch (cpuError) {
            // Handle errors specifically from CPU turn processing
            console.error('Failed to process CPU turn:', debugMode ? cpuError : cpuError.message);
            socket.emit('errorMessage', cpuError.message);
          } finally {
            // Unlock CPU processing for this game so player can act next
            cpuProcessingLock.delete(gameId);

            if (game.winner) {
              endGame(gameId);
              socket.emit('message', `Game over. Winner: ${game.winner}`);
            }
          }
        }

      } catch (playerError) {
        // Handle errors from the player's turn processing
        console.error('Failed to process player intent:', debugMode ? playerError : playerError.message);
        socket.emit('errorMessage', playerError.message);
      }

      // Helper function to end and cleanup game
      function endGame(gameId) {
        cpuProcessingLock.delete(gameId);
        // Delete game from memory after 3 minutes
        setTimeout(() => {
          delete activeGames[gameId];
        }, 1000 * 60 * 3);
      }
    });
  });
};
