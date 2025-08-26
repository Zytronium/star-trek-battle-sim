// NOTE: Requires socket.io client lib already loaded on page

let ships = []; // populated by loadShips()
let selectedShips = { player1: null, player2: null };
let socket = null;
let gamePin = null;
let spectatePin = null;
let isHost = false;    // true if this client created the waiting room
let joinedRoom = false; // true if we've successfully joined a waiting room
let localSlot = 'p1';  // UI always shows "You (Player 1)" locally
let serverRoomState = null; // latest sanitized waiting room state from server

// --- Ships loader & UI helpers (self-contained for waiting room) ---

// Fetch ships, populate dropdowns, and resolve when done
async function loadShips() {
  console.log('[ships] Starting loadShips()');
  try {
    const res = await fetch('/api/ships', { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[ships] /api/ships returned HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }

    ships = await res.json();
    console.log(`[ships] Loaded ${Array.isArray(ships) ? ships.length : 'unknown'} ships from API`);

    populateDropdowns();

    // Hide loading, show main interface (these IDs exist in your HTML)
    const loadingEl = document.getElementById('loading');
    const battleInterface = document.getElementById('battle-interface');
    if (loadingEl) loadingEl.style.display = 'none';
    if (battleInterface) battleInterface.style.display = 'block';

    // If no ships were returned, show a friendly message
    if (!Array.isArray(ships) || ships.length === 0) {
      const errEl = document.getElementById('error');
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = 'No ships found in database.';
      }
      console.warn('[ships] No ships found');
    }

    return ships;
  } catch (err) {
    console.error('Error loading ships:', err);
    const errEl = document.getElementById('error');
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Failed to load ships. Please check the server or your network and try again.';
    }
    // Also hide the spinner so user can act on the error
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
    throw err;
  }
}

// Fill selects. For waiting room, p2 is read-only; p1 is interactive.
function populateDropdowns() {
  const p1Sel = document.getElementById('player1-select');
  const p2Sel = document.getElementById('player2-select');

  if (p1Sel) {
    p1Sel.innerHTML = '<option value="">-- Select a ship --</option>';
    if (Array.isArray(ships)) {
      ships.forEach(ship => {
        const opt = document.createElement('option');
        opt.value = ship.ship_id;
        opt.textContent = `${ship.name} (${ship.class})`;
        p1Sel.appendChild(opt);
      });
    } else {
      // fallback option
      p1Sel.innerHTML += '<option value="">(no ships available)</option>';
    }
  } else {
    console.warn('[populateDropdowns] #player1-select not found in DOM');
  }

  if (p2Sel) {
    // Start read-only with a placeholder; server updates this via `updateOpponentShipDisplay`
    p2Sel.innerHTML = '<option value="">-- Not Selected Yet --</option>';
    p2Sel.disabled = true;
  } else {
    console.warn('[populateDropdowns] #player2-select not found in DOM');
  }
}


// Simple card renderer (matches your existing styling in setup.js)
function createShipDisplay(ship) {
  const shield = Number(ship.shield_strength || 0);
  const hull   = Number(ship.hull_strength || 0);

  return `
    <div class="health-bars">
      <div class="health-bar">
        <div class="health-bar-label">
          <span>Shields</span>
          <span>${shield}</span>
        </div>
        <div class="shield-bar"><div class="shield-fill"></div></div>
      </div>
      <div class="health-bar">
        <div class="health-bar-label">
          <span>Hull</span>
          <span>${hull}</span>
        </div>
        <div class="health-bar-red"><div class="health-fill"></div></div>
      </div>
    </div>
    <div class="ship-image">
      <img src="${ship.image_src?.startsWith('/') ? ship.image_src : `/${ship.image_src || ''}`}" alt="${ship.name}">
    </div>
    <div class="ship-name">${ship.name}</div>
    <div class="ship-details">
      <div><strong>Class:</strong> ${ship.class}</div>
      <div><strong>Owner:</strong> ${ship.owner}</div>
      <div><strong>Registry:</strong> ${ship.registry || 'N/A'}</div>
    </div>
    ${ship.description ? `<div class="ship-description">"${ship.description}"</div>` : ''}
  `;
}

// Local UI updater for the player’s own selection (player1)
function selectShip(player, shipId) {
  const displayEl = document.getElementById(`${player}-ship-display`);
  if (!shipId) {
    selectedShips[player] = null;
    if (displayEl) displayEl.style.display = 'none';
    return;
  }

  const ship = ships.find(s => String(s.ship_id) === String(shipId));
  if (!ship) return;

  selectedShips[player] = ship;
  if (displayEl) {
    displayEl.innerHTML = createShipDisplay(ship);
    displayEl.style.display = 'block';
  }
}

// ---------- tokens ----------
function generatePlayerToken(length = 32) {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    console.warn('Secure crypto unavailable — falling back to Math.random.');
    let s = '';
    for (let i = 0; i < length; i++) s += Math.floor(Math.random()*256).toString(16).padStart(2,'0');
    return s;
  }
}
function getPlayerToken() {
  let t = localStorage.getItem('playerToken');
  if (!t) {
    t = generatePlayerToken();
    localStorage.setItem('playerToken', t);
    console.log('[token] generated and saved');
  }
  return t;
}
const playerToken = getPlayerToken();

// ---------- helpers to update DOM ----------
function setJoinPin(pin) {
  const el = document.getElementById('join-pin');
  const row = document.getElementById('join-pin-row');
  if (!el || !row) return;
  el.textContent = pin || '—';
  if (!pin) row.style.display = 'none';
  else row.style.display = 'block';
}
function setSpectatePin(pin) {
  const el = document.getElementById('spectate-pin');
  if (!el) return;
  el.textContent = pin || '—';
}

// Show waiting message when p2 not present
function showWaitingForPlayer() {
  const remoteIndicator = document.getElementById('remote-ready-indicator');
  if (remoteIndicator) remoteIndicator.textContent = 'Waiting for player to join...';
}

// Update ready indicators for local and remote
function updateReadyIndicators(room) {
  const localReadyBtn = document.getElementById('local-ready-btn');
  const localIndicator = document.getElementById('local-ready-indicator');
  const remoteIndicator = document.getElementById('remote-ready-indicator');

  const localReady = room && getPlayerSlotForToken(room, playerToken) && room[getPlayerSlotForToken(room, playerToken)].ready;
  const remoteSlot = getOtherSlot(room, playerToken);
  const remoteReady = room && remoteSlot && room[remoteSlot] ? room[remoteSlot].ready : false;

  if (localReadyBtn) {
    // disable local ready button until both players are connected
    const bothPresent = (room && room.p1 && room.p2);
    localReadyBtn.disabled = !bothPresent;
    localReadyBtn.textContent = localReady ? 'Ready ✓' : 'Not Ready';
    localReadyBtn.classList.toggle('ready', !!localReady);
  }

  if (localIndicator) localIndicator.textContent = localReady ? 'Ready — waiting on opponent' : 'Not ready';
  if (!room || !room.p2) {
    if (remoteIndicator) remoteIndicator.textContent = 'Waiting for player to join...';
  } else {
    if (remoteIndicator) remoteIndicator.textContent = remoteReady ? 'Opponent: Ready ✓' : 'Opponent: Not ready';
  }
}

// Populate opponent's ship dropdown (read-only) and display their ship card
function updateOpponentShipDisplay(room) {
  const player2Select = document.getElementById('player2-select');
  const player2Display = document.getElementById('player2-ship-display');

  // Clear options and set one that matches the opponent if available
  if (!player2Select || !player2Display) return;

  // Reset
  player2Select.innerHTML = '<option value="">-- Not Selected Yet --</option>';
  player2Display.style.display = 'none';
  player2Display.innerHTML = '';

  if (!room || !room.p2) {
    // show waiting state
    player2Select.disabled = true;
    showWaitingForPlayer();
    return;
  }

  // If the server sent a ship object for p2, attempt to find the matching ship from local ships list
  const p2ship = room.p2.ship || null;
  if (!p2ship) return;

  // Find ship by ship_id first (server may store full object or only id)
  let shipObj = ships.find(s => String(s.ship_id) === String(p2ship.ship_id || p2ship));
  if (!shipObj && p2ship.ship_id && typeof p2ship !== 'string') shipObj = p2ship; // if server sent object, use it

  if (shipObj) {
    const option = document.createElement('option');
    option.value = shipObj.ship_id;
    option.textContent = `${shipObj.name} (${shipObj.class})`;
    player2Select.appendChild(option);
    player2Select.value = shipObj.ship_id;
    player2Select.disabled = true;

    // render display card
    player2Display.innerHTML = createShipDisplay(shipObj);
    player2Display.style.display = 'block';
  }
}

// Retreive which internal slot ('p1'|'p2') belongs to token
function getPlayerSlotForToken(room, token) {
  if (!room) return null;
  if (room.p1 && room.p1.token_hidden_id === token_hidden_identifier(token)) {
    return 'p1';
  }
  if (room.p2 && room.p2.token_hidden_id === token_hidden_identifier(token)) {
    return 'p2';
  }
  // fallback: attempt to match by presence of a token marker placed by server (if any). If not present, check equality with server's stored token? NOTE: server must not send token.
  // As the server will not return tokens, use a different map: server returns token_hidden_id (see server code) for each player so clients can map themselves.
  return null;
}

// Helper to produce token-hidden-identifer — it's an irreversible short fingerprint the server can include
function token_hidden_identifier(token) {
  // short, local-only fingerprint used to compare without leaking tokens.
  // we use first 8 hex chars as a simple identifier; server will do the same when sending sanitized waiting room.
  return String(token).slice(0,8);
}

// Return the other slot name when given room & my token
function getOtherSlot(room, myToken) {
  if (!room) return null;
  const mine = getPlayerSlotForToken(room, myToken);
  if (!mine) return null;
  return mine === 'p1' ? 'p2' : 'p1';
}

// Update the local UI from a sanitized waitingRoom object
function applyWaitingRoomUpdate(room) {
  serverRoomState = room;

  // Show pins
  // The server will instruct when to remove joinPin (joinPin hidden once both players are present)
  setSpectatePin(room.spectatePin);
  setJoinPin(room.p2 ? null : room.gamePin);

  // Update p1 and p2 ship displays
  // For the local client we always show "You (Player 1)" — select the local ship from room for our token
  const p1ShipObj = room.p1 ? room.p1.ship : null;
  if (p1ShipObj) {
    // set player1 UI to match server state (use local display)
    const player1Select = document.getElementById('player1-select');
    const player1Display = document.getElementById('player1-ship-display');
    if (player1Select) {
      // set selected option if it exists locally
      player1Select.value = p1ShipObj.ship_id || p1ShipObj; // if server returned id or object
    }
    if (player1Display) {
      // render
      const shipObj = ships.find(s => String(s.ship_id) === String(p1ShipObj.ship_id || p1ShipObj));
      if (shipObj) {
        player1Display.innerHTML = createShipDisplay(shipObj);
        player1Display.style.display = 'block';
      }
    }
  }

  // Update opponent display
  updateOpponentShipDisplay(room);

  // Update ready indicators
  updateReadyIndicators(room);

  // If both players are present and both ready, enable the start button on the client side
  const battleBtn = document.getElementById('battle-btn');
  if (room.p1 && room.p2 && room.p1.ready && room.p2.ready) {
    if (battleBtn) battleBtn.disabled = false;
    // Let server also emit bothReady — handled separately
  } else {
    if (battleBtn) battleBtn.disabled = true;
  }
}

// ---------- Socket handlers ----------
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('[socket] connected', socket.id);
  });

  socket.on('waitingRoomUpdated', (sanitizedRoom) => {
    // sanitizedRoom is a version with no tokens, but with token_hidden_id fields so clients can map themselves
    console.log('[socket] waitingRoomUpdated', sanitizedRoom);
    applyWaitingRoomUpdate(sanitizedRoom);
  });

  socket.on('createdWaitingRoom', (data) => {
    // callback-style alternative; may not be used if we rely on the create callback.
    console.log('[socket] createdWaitingRoom', data);
  });

  socket.on('bothReady', (data) => {
    console.log('[socket] bothReady', data);
    // server informs that both players are ready — UI already enables start button if both ready
    // (no extra action necessary here other than possibly notifying the user)
  });

  socket.on('roomJoined', (data) => {
    console.log('[socket] roomJoined', data);
    // server confirmed join
  });

  socket.on('errorMessage', (msg) => {
    console.warn('[socket error]', msg);
    // optionally show toast
    const errEl = document.getElementById('error');
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = msg;
    }
  });

  socket.on('gameStarted', (payload) => {
    // server indicates game has been created. Should include the gameId.
    // navigate to actual battle page (server should sanitize any sensitive info)
    if (payload && payload.gameId) {
      // Example: navigate to the game URL
      window.location.href = `/game?gameId=${payload.gameId}`;
    } else {
      console.warn('gameStarted without gameId');
    }
  });

  // Reconnection handling could be added: on reconnect re-join waiting room if needed
}

// ---------- Client → Server actions ----------

// Convert a local ship object -> minimal waiting-room ship descriptor
function toWaitingRoomShipDescriptor(localShip, pilot = 'P1') {
  if (!localShip) return null;
  return {
    ship_id: localShip.ship_id,
    pilot: pilot,      // 'P1' for host, 'P2' for joiner
    is_boss: !!localShip.is_boss // default false for normal ships
  };
}

async function createWaitingRoomOnServer(spectateVis, joinVis, p1ShipObj) {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not initialized'));
    if (!p1ShipObj) return reject(new Error('No ship provided'));

    // Convert to minimal descriptor required by server validation
    const minimal = toWaitingRoomShipDescriptor(p1ShipObj, 'P1');

    socket.emit('createWaitingRoom', {
      spectateVis,
      joinVis,
      p1Ship: minimal,
      playerToken
    }, (resp) => {
      if (!resp) return reject(new Error('No response'));
      if (resp.error) return reject(new Error(resp.error));
      // resp.room is sanitized waiting room, resp.gamePin & resp.spectatePin included
      console.log('createWaitingRoom response', resp);
      gamePin = resp.gamePin;
      spectatePin = resp.spectatePin;
      isHost = true;
      joinedRoom = true;
      applyWaitingRoomUpdate(resp.room);
      resolve(resp.room);
    });
  });
}

async function joinWaitingRoomOnServer(pin, p2ShipObj) {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not initialized'));
    if (!p2ShipObj) return reject(new Error('No ship provided'));

    // Convert to minimal descriptor required by server. Use pilot 'P2'.
    const minimal = toWaitingRoomShipDescriptor(p2ShipObj, 'P2');

    socket.emit('joinWaitingRoom', {
      gamePin: pin,
      playerToken,
      p2Ship: minimal
    }, (resp) => {
      if (!resp) return reject(new Error('No response'));
      if (resp.error) return reject(new Error(resp.error));
      gamePin = pin;
      spectatePin = resp.spectatePin || resp.room.spectatePin;
      isHost = false;
      joinedRoom = true;
      applyWaitingRoomUpdate(resp.room);
      resolve(resp.room);
    });
  });
}

function sendSelectShipToServer(shipObj) {
  if (!socket || !gamePin) return;
  if (!shipObj) return;

  // If we're host, server expects p1 format; if we are p2 (we joined), send p2 descriptor.
  // However server doesn't re-validate on selectShip, but keeping descriptor consistent avoids later validation issues.
  const mySlot = localSlot; // localSlot is 'p1' by UI design (you show yourself as p1)
  const pilotName = (mySlot === 'p1') ? 'P1' : 'P2';
  const minimal = toWaitingRoomShipDescriptor(shipObj, pilotName);

  socket.emit('selectShip', {
    gamePin,
    playerToken,
    ship: minimal
  });
}


function toggleReadyStateOnServer(readyState) {
  if (!socket || !gamePin) return;
  socket.emit('toggleReady', {
    gamePin,
    playerToken,
    ready: !!readyState
  }, (resp) => {
    if (resp && resp.error) {
      console.warn('toggleReady error', resp.error);
    }
  });
}

function requestStartGame() {
  if (!socket || !gamePin) return;
  socket.emit('startGame', { gamePin, playerToken }, (resp) => {
    if (resp && resp.error) {
      console.warn('startGame error', resp.error);
      alert('Cannot start game: ' + resp.error);
    } else if (resp && resp.gameId) {
      // server created game and returned gameId; navigate there
      window.location.href = `/game?gameId=${resp.gameId}`;
    }
  });
}

// ---------- UI wiring ----------
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  // loadShips() should exist in your shared setup.js — call it and then wire selects
  // If you have a global loadShips defined in the page, use it; otherwise call this page's fetch.
  loadShips().then(() => {
    // After ships loaded, wire select change handlers
    const player1Select = document.getElementById('player1-select');
    const player2Select = document.getElementById('player2-select');

    // when local user selects their ship, update local display and either create waiting room or send update to server
    player1Select.addEventListener('change', async (e) => {
      const shipId = e.target.value;
      if (!shipId) {
        selectShip('player1', null);
        return;
      }
      selectShip('player1', shipId); // updates local UI (selectedShips variable)
      // send to server as soon as possible: if joinedRoom created, broadcast; else create waiting room
      const shipObj = ships.find(s => String(s.ship_id) === String(shipId));
      if (!joinedRoom) {
        // read query params to determine spectate / private settings
        const params = new URLSearchParams(window.location.search);
        const spectate = params.get('spectateVis') ?? "PUBLIC";
        const joinVis = params.get('joinVis') ?? "PRIVATE";
        try {
          await createWaitingRoomOnServer(spectate, joinVis, shipObj);
        } catch (err) {
          console.error('Failed to create waiting room:', err);
          const errEl = document.getElementById('error');
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
        }
      } else {
        // already in a room — broadcast the new ship
        sendSelectShipToServer(shipObj);
      }
    });

    // There is no local change allowed for player2Select (readonly); its value is updated by server when opponent selects

    // ready button wiring
    const localReadyBtn = document.getElementById('local-ready-btn');
    localReadyBtn.addEventListener('click', () => {
      // check enabled
      if (localReadyBtn.disabled) return;
      // toggle local ready state (we'll flip by reading serverRoomState & our slot)
      const room = serverRoomState;
      const mySlot = getPlayerSlotForToken(room, playerToken);
      const currentlyReady = room && mySlot && room[mySlot].ready;
      // send toggle
      toggleReadyStateOnServer(!currentlyReady);
    });

    // battle button wiring (only actually starts if server allows)
    const battleBtn = document.getElementById('battle-btn');
    battleBtn.addEventListener('click', () => {
      // Only allow start if both present and both ready (backend will verify)
      requestStartGame();
    });

    // If the URL includes join pin (e.g. ?join=1234) automatically attempt to join when the user picks a ship.
    // Alternatively you could build a small join input UI to let the local user paste a pin.
    const params = new URLSearchParams(window.location.search);
    const joinPinParam = params.get('join') || params.get('gamePin');
    if (joinPinParam) {
      // user intends to join existing waiting room
      // require the user to pick their ship, then call joinWaitingRoomOnServer()
      // show a small note
      const note = document.createElement('div');
      note.className = 'dialogue';
      note.textContent = `Joining room ${joinPinParam}. Select your ship to join.`;
      document.querySelector('#player1-ship-selection').appendChild(note);

      // intercept the player1Select change to call join when ship chosen (handled above)
      player1Select.addEventListener('change', async function onChange(e) {
        const shipId = e.target.value;
        if (!shipId) return;
        // prevent duplicate handler
        player1Select.removeEventListener('change', onChange);
        const shipObj = ships.find(s => String(s.ship_id) === String(shipId));
        try {
          await joinWaitingRoomOnServer(joinPinParam, shipObj);
        } catch (err) {
          console.error('Failed to join waiting room:', err);
          const errEl = document.getElementById('error');
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
        }
      });
    }
  });
});
