const socket = io(); // Connect to server
let gameId = null;

/**
 * Generate a cryptographically-secure random token (hex).
 * length: number of random bytes (default 32 bytes => 64 hex chars)
 */
function generatePlayerToken(length = 32) {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    window.crypto.getRandomValues(arr);
    // Convert to hex
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    console.warn('Secure crypto unavailable. Falling back to less secure method.');
    let s = '';
    for (let i = 0; i < length; i++) {
      s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    }
    return s;
  }
}

// Get or create a persistent player token in localStorage.
function getPlayerToken() {
  let token;
  if (!playerToken) {
    token = generatePlayerToken();
    console.log('[Token] Generated new player token');
  }
  return token;
}

let playerToken;
playerToken = getPlayerToken();

// Start battle on battle button click
document.getElementById('battle-btn').addEventListener('click', () => {
  if (selectedShips.player1 && selectedShips.player2) {
    const setup = {
      type: "PLAYER V AI",
      ships: [
        { ship_id: selectedShips.player1.ship_id, pilot: "P1", is_boss: false },
        { ship_id: selectedShips.player2.ship_id, pilot: "COM1", is_boss: false }
      ],
      playerToken: playerToken
    };

    socket.emit('createGame', setup, (response) => {
      if (response.error) {
        console.error('Battle error:', response.error);
        return;
      }

      localStorage.setItem(`playerToken-${response.gameId}-P1`, playerToken);

      // Join WebSocket room
      socket.emit("joinGame", gameId);

      // Redirect to game page with gameId
      window.location.href = `/game?gameId=${response.gameId}`;
    });
  }
});