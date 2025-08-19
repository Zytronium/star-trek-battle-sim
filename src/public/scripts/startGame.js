const socket = io(); // Connect to server

let gameId = null;

// Listen for game updates
socket.on("gameUpdate", (gameState) => {
  console.log("Game update:", gameState);
  // Update your UI: logs, health bars, etc.
});

// Example: send player action
function sendPlayerIntent(intent) {
  if (!gameId)
    return;
  socket.emit("playerIntent", { gameId, intent });
}

// Start battle on battle button click
document.getElementById('battle-btn').addEventListener('click', () => {
  if (selectedShips.player1 && selectedShips.player2) {
    const setup = {
      type: "PLAYER V AI",
      ships: [
        { ship_id: selectedShips.player1.ship_id, pilot: "P1", is_boss: false },
        { ship_id: selectedShips.player2.ship_id, pilot: "COM1", is_boss: false }
      ]
    };

    socket.emit('createGame', setup, (response) => {
      if (response.error) {
        console.error('Battle error:', response.error);
        return;
      }

      // Join WebSocket room
      socket.emit("joinGame", gameId);

      // Redirect to game page with gameId
      window.location.href = `game.html?gameId=${response.gameId}`;
    });
  }
});