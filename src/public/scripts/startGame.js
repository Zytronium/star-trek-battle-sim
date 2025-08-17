const socket = io(); // Connect to server

let gameId = null;

// Create a new game via your REST endpoint
async function startBattle(player1ShipId, cpuShipId) {
  const res = await fetch("/engine/game/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "PLAYER V AI",
      ships: [
        { ship_id: player1ShipId, pilot: "P1", is_boss: false },
        { ship_id: cpuShipId, pilot: "COM1", is_boss: false }
      ]
    })
  });

  const data = await res.json();
  gameId = data.gameId;

  // Join WebSocket room
  socket.emit("joinGame", gameId);
}

// Listen for game updates
socket.on("gameUpdate", (gameState) => {
  console.log("Game update:", gameState);
  // Update your UI: logs, health bars, etc.
});

// Example: send player action
function sendPlayerIntent(intent) {
  if (!gameId) return;
  socket.emit("playerIntent", { gameId, intent });
}

// Hook into your battle button
document.getElementById("battle-btn").addEventListener("click", async () => {
  if (selectedShips.player1 && selectedShips.player2) {
    await startBattle(selectedShips.player1.ship_id, selectedShips.player2.ship_id);
  }
});