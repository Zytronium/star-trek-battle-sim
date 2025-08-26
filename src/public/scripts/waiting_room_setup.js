// NOTE: Requires socket.io client lib already loaded on page

let ships = []; // fetched from /api/ships
let selectedShips = { player1: null, player2: null };
let socket = null;
let gamePin = null;
let spectatePin = null;
let isHost = false;         // true if server assigns this client to p1
let joinedRoom = false;     // true after createWaitingRoom/joinWaitingRoom success
let localSlot = null;       // 'p1' or 'p2' once determined from server
let serverRoomState = null; // latest sanitized waiting room from server

// Pending join PIN entered before selecting a ship
let pendingJoinPin = null;

// ---------------- Ships API & UI helpers ----------------

async function loadShips() {
  console.log('[ships] Starting loadShips()');
  try {
    const res = await fetch('/api/ships', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ships = await res.json();
    console.log(`[ships] Loaded ${Array.isArray(ships) ? ships.length : 'unknown'} ships from API`);
    populateDropdowns();

    const loadingEl = document.getElementById('loading');
    const battleInterface = document.getElementById('battle-interface');
    if (loadingEl) loadingEl.style.display = 'none';
    if (battleInterface) battleInterface.style.display = 'block';

    if (!Array.isArray(ships) || ships.length === 0) {
      const errEl = document.getElementById('error');
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'No ships found in database.'; }
      console.warn('[ships] No ships found');
    }

    // ensure join input visibility gets set after ships populate
    updateJoinInputVisibility();

    return ships;
  } catch (err) {
    console.error('[ships] Error loading ships:', err);
    const errEl = document.getElementById('error');
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Failed to load ships. Please try again.'; }
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
    throw err;
  }
}

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
      p1Sel.innerHTML += '<option value="">(no ships available)</option>';
    }
  } else {
    console.warn('[populateDropdowns] #player1-select not found');
  }

  if (p2Sel) {
    p2Sel.innerHTML = '<option value="">-- Not Selected Yet --</option>';
    p2Sel.disabled = true;
  } else {
    console.warn('[populateDropdowns] #player2-select not found');
  }
}

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

function selectShip(player, shipId) {
  const displayEl = document.getElementById(`${player}-ship-display`);
  if (!shipId) {
    selectedShips[player] = null;
    if (displayEl) displayEl.style.display = 'none';
    // toggling join input now that no ship selected
    updateJoinInputVisibility();
    return;
  }

  const ship = ships.find(s => String(s.ship_id) === String(shipId));
  if (!ship) return;

  selectedShips[player] = ship;
  if (displayEl) {
    displayEl.innerHTML = createShipDisplay(ship);
    displayEl.style.display = 'block';
  }

  // If user had a pending join PIN, attempt join immediately after they pick ship
  if (pendingJoinPin && !joinedRoom) {
    (async () => {
      const pin = pendingJoinPin;
      // Show the pending note (already shown by updateJoinInputVisibility), but make it explicit
      showJoinNote(`Attempting to join room ${pin}...`, false);

      // disable join button while auto-joining (if present)
      const joinBtn = document.getElementById('join-pin-join-button');
      if (joinBtn) { joinBtn.disabled = true; joinBtn.dataset.loading = 'true'; }

      try {
        await joinWaitingRoomOnServer(pin, ship);
        // success -> consume pending PIN and clear UI
        pendingJoinPin = null;
        if (joinBtn) { joinBtn.disabled = false; delete joinBtn.dataset.loading; }
        clearJoinPendingNote();
        updateJoinInputVisibility();
      } catch (err) {
        // keep pending PIN so user can cancel or retry; show server error
        const msg = (err && err.message) ? err.message : String(err);
        showJoinNote(msg, true);
        console.error('Auto-join failed after selecting ship:', err);
        if (joinBtn) { joinBtn.disabled = false; delete joinBtn.dataset.loading; }
        // leave pendingJoinPin intact so user can cancel
      }
    })();
  } else {
    // If not joining, keep join input hidden since user selected a ship
    updateJoinInputVisibility();
  }
}

// ---------------- tokens & helper mapping ----------------

function generatePlayerToken(length = 32) {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(length);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
  } else {
    console.warn('Secure crypto unavailable. Falling back to less secure method.');
    let s = '';
    for (let i=0;i<length;i++) {
      s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    }
    return s;
  }
}

function getPlayerToken() {
  let token;
  if (gamePin)
    token = localStorage.getItem(`playerToken-${gamePin}-${isHost ? 'P1' : 'P2'}`);
  else if (playerToken)
    token = playerToken;
  else
    token = generatePlayerToken();

  console.log(`[token - debug] gamePin: ${gamePin}`);

  if (!token) { // gamePin exists but item was not found in localStorage
    token = playerToken ?? generatePlayerToken();
    localStorage.setItem(`playerToken-${gamePin}-${isHost ? 'P1' : 'P2'}`, token);
    console.log('[token] generated and saved');
  }
  return token;
}

let playerToken; // Define later; getPlayerToken() requires playerToken must be at least declared, even if undefined
playerToken = getPlayerToken();

function token_hidden_identifier(token) {
  return String(token).slice(0,6);
}

function getPlayerSlotForToken(room, token) {
  if (!room) return null;
  if (room.p1 && room.p1.token_hidden_id === token_hidden_identifier(token)) return 'p1';
  if (room.p2 && room.p2.token_hidden_id === token_hidden_identifier(token)) return 'p2';
  return null;
}

// ---------------- UI helpers ----------------

function setJoinPin(pin) {
  const el = document.getElementById('join-pin');
  const row = document.getElementById('join-pin-row');
  if (!el || !row) return;
  el.textContent = pin || '—';
  row.style.display = pin ? 'block' : 'none';
}
function setSpectatePin(pin) {
  const el = document.getElementById('spectate-pin');
  if (!el) return;
  el.textContent = pin || '—';
}

function showWaitingForPlayer() {
  const remoteIndicator = document.getElementById('remote-ready-indicator');
  if (remoteIndicator) remoteIndicator.textContent = 'Waiting for player to join...';
}

function showError(msg) {
  const errEl = document.getElementById('error');
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

// Helper — populate a <select> with all ships, optionally select a given id
function populateSelectWithShips(selectEl, selectedId = null, enabled = true) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">-- Select a ship --</option>';
  if (Array.isArray(ships)) {
    ships.forEach(ship => {
      const opt = document.createElement('option');
      opt.value = ship.ship_id;
      opt.textContent = `${ship.name} (${ship.class})`;
      if (String(ship.ship_id) === String(selectedId)) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }
  selectEl.disabled = !enabled;
}

// Render a server slot (p1/p2) into the left or right UI side.
// Keep full select list for the local slot so user can change selection.
function renderSlotToSide(room, slotName, uiSide) {
  const selectEl = uiSide === 'left' ? document.getElementById('player1-select') : document.getElementById('player2-select');
  const displayEl = uiSide === 'left' ? document.getElementById('player1-ship-display') : document.getElementById('player2-ship-display');
  const headerEl = uiSide === 'left' ? document.querySelector('#player1-ship-selection h2') : document.querySelector('#player2-ship-selection h2');

  if (headerEl) {
    const slotNum = slotName === 'p1' ? '1' : '2';
    const isLocal = (localSlot === slotName);
    headerEl.textContent = isLocal ? `You (Player ${slotNum})` : `Opponent (Player ${slotNum})`;
  }

  // No room or no player in that slot
  if (!room || !room[slotName] || !room[slotName].ship) {
    // For local slot: show full list so user can pick
    if (selectEl) {
      if (localSlot === slotName) {
        populateSelectWithShips(selectEl, null, true);
      } else {
        // opponent side: readonly placeholder
        selectEl.innerHTML = '<option value="">-- Not Selected Yet --</option>';
        selectEl.disabled = true;
      }
    }
    if (displayEl) displayEl.style.display = 'none';
    return;
  }

  // There is a ship for this slot
  const slotShip = room[slotName].ship;
  let shipObj = ships.find(s => String(s.ship_id) === String(slotShip.ship_id || slotShip));
  if (!shipObj && typeof slotShip === 'object' && slotShip.ship_id) shipObj = slotShip;

  if (shipObj) {
    if (selectEl) {
      if (localSlot === slotName) {
        // local player: keep full list but select the chosen ship so user can change
        populateSelectWithShips(selectEl, shipObj.ship_id, true);
      } else {
        // opponent: show single selected option and disable the select
        selectEl.innerHTML = '';
        const option = document.createElement('option');
        option.value = shipObj.ship_id;
        option.textContent = `${shipObj.name} (${shipObj.class})`;
        option.selected = true;
        selectEl.appendChild(option);
        selectEl.disabled = true;
      }
    }

    if (displayEl) {
      displayEl.innerHTML = createShipDisplay(shipObj);
      displayEl.style.display = 'block';
    }
  }
}

function updateReadyIndicators(room) {
  const localReadyBtn = document.getElementById('local-ready-btn');
  const localIndicator = document.getElementById('local-ready-indicator');
  const remoteIndicator = document.getElementById('remote-ready-indicator');

  const mySlot = getPlayerSlotForToken(room, getPlayerToken());
  const localReady = room && mySlot && room[mySlot] ? room[mySlot].ready : false;
  const otherSlot = mySlot === 'p1' ? 'p2' : 'p1';
  const remoteReady = room && otherSlot && room[otherSlot] ? room[otherSlot].ready : false;

  if (localReadyBtn) {
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

  const battleBtn = document.getElementById('battle-btn');
  if (battleBtn) {
    const bothReady = room && room.p1 && room.p2 && room.p1.ready && room.p2.ready;
    const amHost = (getPlayerSlotForToken(room, playerToken) === 'p1');
    battleBtn.disabled = !(bothReady && amHost);
  }
}

function applyWaitingRoomUpdate(room) {
  if (!room) return;
  serverRoomState = room;

  const slotForMe = getPlayerSlotForToken(room, playerToken);
  if (slotForMe) {
    localSlot = slotForMe;
    isHost = (localSlot === 'p1');
  }

  setSpectatePin(room.spectatePin);
  setJoinPin(room.p2 ? null : room.gamePin);

  // When user becomes assigned a slot, persist the token into localStorage for future visits
  if (joinedRoom && gamePin && playerToken && localSlot) {
    try {
      localStorage.setItem(`playerToken-${gamePin}-${localSlot === 'p1' ? 'P1' : 'P2'}`, playerToken);
    } catch (e) {
      console.warn('Failed to store player token locally', e);
    }
  }

  let leftSlot, rightSlot;
  if (localSlot === 'p1') { leftSlot = 'p1'; rightSlot = 'p2'; }
  else if (localSlot === 'p2') { leftSlot = 'p2'; rightSlot = 'p1'; }
  else { leftSlot = 'p1'; rightSlot = 'p2'; }

  renderSlotToSide(room, leftSlot, 'left');
  renderSlotToSide(room, rightSlot, 'right');

  updateReadyIndicators(room);

  // join input visibility might change once the room updates (e.g. if p2 auto-joined)
  updateJoinInputVisibility();
}

// ---------------- Socket handlers ----------------

function initSocket() {
  socket = io();

  socket.on('connect', () => console.log('[socket] connected', socket.id));
  socket.on('waitingRoomUpdated', (sanitizedRoom) => {
    console.log('[socket] waitingRoomUpdated', sanitizedRoom);
    applyWaitingRoomUpdate(sanitizedRoom);
  });
  socket.on('createdWaitingRoom', (data) => console.log('[socket] createdWaitingRoom', data));
  socket.on('bothReady', (data) => console.log('[socket] bothReady', data));
  socket.on('roomJoined', (data) => console.log('[socket] roomJoined', data));
  socket.on('errorMessage', (msg) => {
    console.warn('[socket error]', msg);
    const errEl = document.getElementById('error');
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; }
  });
  socket.on('gameStarted', (payload) => {
    if (payload && payload.gameId) {
      let t = getPlayerToken();

      // Persist permanent token so other devices can authenticate later (existing behavior)
      localStorage.setItem(`playerToken-${payload.gameId}-${isHost ? 'P1' : 'P2'}`, t);

      // IMPORTANT: mark this specific browser tab/window as the pilot for the upcoming game.
      // sessionStorage is per-tab, so it won't confuse other tabs on the same device.
      try {
        sessionStorage.setItem(`playerPilot-${payload.gameId}`, isHost ? 'P1' : 'P2');
      } catch (e) {
        console.warn('Failed to set sessionPilot marker', e);
      }

      // cleanup token used for waiting-room (optional)
      try {
        localStorage.removeItem(`playerToken-${gamePin}-${isHost ? 'P1' : 'P2'}`);
      } catch(e) {}

      // navigate into the game page
      window.location.href = `/game?gameId=${payload.gameId}`;
    } else {
      console.warn('gameStarted without gameId');
    }
  });

}

// ---------------- Client → Server actions ----------------

function toWaitingRoomShipDescriptor(localShip, pilot = 'P1') {
  if (!localShip) return null;
  return {
    ship_id: localShip.ship_id,
    pilot,
    is_boss: !!localShip.is_boss
  };
}

async function createWaitingRoomOnServer(spectateVis, joinVis, p1ShipObj) {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not initialized'));
    if (!p1ShipObj) return reject(new Error('No ship provided'));

    const minimal = toWaitingRoomShipDescriptor(p1ShipObj, 'P1');

    socket.emit('createWaitingRoom', {
      spectateVis,
      joinVis,
      p1Ship: minimal,
      playerToken
    }, (resp) => {
      if (!resp) return reject(new Error('No response'));
      if (resp.error) return reject(new Error(resp.error));

      gamePin = resp.gamePin;
      spectatePin = resp.spectatePin;
      joinedRoom = true;

      localSlot = getPlayerSlotForToken(resp.room, playerToken) || 'p1';
      isHost = (localSlot === 'p1');

      applyWaitingRoomUpdate(resp.room);
      resolve(resp.room);
    });
  });
}

async function joinWaitingRoomOnServer(pin, p2ShipObj) {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not initialized'));
    if (!p2ShipObj) return reject(new Error('No ship provided'));
    if (!pin) return reject(new Error('No join PIN provided'));

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
      joinedRoom = true;

      localSlot = getPlayerSlotForToken(resp.room, playerToken) || 'p2';
      isHost = (localSlot === 'p1');

      applyWaitingRoomUpdate(resp.room);
      resolve(resp.room);
    });
  });
}

function sendSelectShipToServer(shipObj) {
  if (!socket || !gamePin || !shipObj) return;

  const mySlot = serverRoomState ? getPlayerSlotForToken(serverRoomState, playerToken) : localSlot;
  const pilot = (mySlot === 'p2') ? 'P2' : 'P1';
  const minimal = toWaitingRoomShipDescriptor(shipObj, pilot);

  socket.emit('selectShip', { gamePin, playerToken, ship: minimal });
}

function toggleReadyStateOnServer(readyState) {
  if (!socket || !gamePin) return;
  socket.emit('toggleReady', { gamePin, playerToken, ready: !!readyState }, (resp) => {
    if (resp && resp.error) console.warn('toggleReady error', resp.error);
  });
}

function requestStartGame() {
  if (!socket || !gamePin) return;
  socket.emit('startGame', { gamePin, playerToken }, (resp) => {
    if (resp && resp.error) {
      console.warn('startGame error', resp.error);
      alert('Cannot start game: ' + resp.error);
    } else if (resp && resp.gameId) {
      window.location.href = `/game?gameId=${resp.gameId}`;
    }
  });
}

// ---------------- Join PIN UI helpers ----------------

function updateJoinInputVisibility() {
  const joinRow = document.getElementById('join-pin-input-row');
  const player1Select = document.getElementById('player1-select');
  const joinCancelBtn = document.getElementById('join-pin-cancel-button');
  const joinNote = document.getElementById('join-note');
  if (!joinRow || !player1Select || !joinNote) return;

  // Show join input if:
  //  - user has not selected a ship AND hasn't joined a room
  //  OR
  //  - there is an active pendingJoinPin (we keep input visible until the pending join resolves)
  const noShipSelected = !player1Select.value;
  const showBecausePending = !!pendingJoinPin && !joinedRoom;
  if ((noShipSelected && !joinedRoom) || showBecausePending) {
    joinRow.classList.remove('hidden');
  } else {
    joinRow.classList.add('hidden');
  }

  // Show/hide cancel button when we have a pending PIN or if already joined (allow leaving)
  if (joinCancelBtn) {
    if ((pendingJoinPin && !joinedRoom) || joinedRoom) joinCancelBtn.classList.remove('hidden');
    else joinCancelBtn.classList.add('hidden');
  }

  // Update join-note text if a pending PIN exists
  if (pendingJoinPin && !joinedRoom) {
    joinNote.textContent = `Pending join for room ${pendingJoinPin}. Select a ship to join.`;
    joinNote.classList.remove('hidden');
    joinNote.classList.remove('error');
  } else {
    // leave join-note visible for explicit messages only (error/success)
    if (!joinNote.classList.contains('error')) {
      joinNote.textContent = '';
      joinNote.classList.add('hidden');
    }
  }
}

function setPendingJoinPin(pin) {
  pendingJoinPin = pin ? String(pin).trim() : null;
  // show a note for the user if they haven't selected a ship yet
  updateJoinInputVisibility();
}

function showJoinNote(message, isError = false) {
  const joinNote = document.getElementById('join-note');
  if (!joinNote) return;
  joinNote.textContent = message || '';
  joinNote.classList.remove('hidden');
  if (isError) {
    joinNote.classList.add('error');
    // also mirror into main #error for visibility (optional)
    const errEl = document.getElementById('error');
    if (errEl) { errEl.textContent = message; errEl.style.display = 'block'; }
  } else {
    joinNote.classList.remove('error');
  }
}

function clearJoinPendingNote() {
  const joinNote = document.getElementById('join-note');
  if (joinNote) {
    joinNote.textContent = '';
    joinNote.classList.add('hidden');
    joinNote.classList.remove('error');
  }
  // Also clear global error box
  const errEl = document.getElementById('error');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
}


// ---------------- UI wiring (single-time bindings) ----------------

document.addEventListener('DOMContentLoaded', () => {
  initSocket();

  // Grab join UI elements early
  const joinInput = document.getElementById('join-pin-input');
  const joinBtn = document.getElementById('join-pin-join-button');
  const joinCancelBtn = document.getElementById('join-pin-cancel-button');
  const player1Select = document.getElementById('player1-select');
  const player2Select = document.getElementById('player2-select');

  // Wire join input/button behavior
  if (joinInput) {
    joinInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (joinBtn) joinBtn.click();
      }
    });
  }

  if (joinBtn) {
    joinBtn.addEventListener('click', async () => {
      const raw = (joinInput && joinInput.value) ? joinInput.value.trim() : '';
      if (!raw) {
        showJoinNote('Please enter a join PIN first.', true);
        return;
      }

      // Set pending PIN and show immediate pending UI
      setPendingJoinPin(raw);
      showJoinNote(`Pending join for room ${raw}. Select a ship to join.`, false);
      updateJoinInputVisibility();

      // disable join button while we attempt the join
      joinBtn.disabled = true;
      joinBtn.dataset.loading = 'true';
      const prevText = joinBtn.textContent;
      joinBtn.textContent = 'Joining...';

      try {
        const shipId = player1Select ? player1Select.value : null;

        if (shipId) {
          // attempt immediate join
          const shipObj = ships.find(s => String(s.ship_id) === String(shipId));
          if (!shipObj) throw new Error('Selected ship not found.');
          await joinWaitingRoomOnServer(raw, shipObj);
          // success
          setPendingJoinPin(null);
          clearJoinPendingNote();
          if (joinInput) joinInput.value = '';
        } else {
          // No ship selected yet: keep pending state and UI, user will pick a ship to auto-join
          showJoinNote(`Pending join for room ${raw}. Select your ship to complete join.`, false);
        }
      } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        // persistent error shown inside join-note (so user can cancel or retry)
        showJoinNote(msg, true);
        console.error('Join attempt failed:', err);
        // keep pendingJoinPin so user can cancel/try again
      } finally {
        // re-enable join button and restore text
        joinBtn.disabled = false;
        delete joinBtn.dataset.loading;
        joinBtn.textContent = prevText;
        // show/hide inputs according to new state
        updateJoinInputVisibility();
      }
    });
  }


  if (joinCancelBtn) {
    joinCancelBtn.addEventListener('click', async () => {
      // If we are already joined to a waiting room, leave it server-side
      if (joinedRoom && gamePin) {
        try {
          await new Promise((resolve, reject) => {
            socket.emit('leaveWaitingRoom', { gamePin }, (resp) => {
              if (!resp) return reject(new Error('No response from server'));
              if (resp.error) return reject(new Error(resp.error));
              resolve(resp);
            });
          });
        } catch (err) {
          const msg = (err && err.message) ? err.message : String(err);
          showJoinNote(msg, true);
          return;
        }

        // left successfully: clear local room state so user can create another room
        // remove stored playerToken for the old room BEFORE clearing gamePin
        try {
          localStorage.removeItem(`playerToken-${gamePin}-${isHost ? 'P1' : 'P2'}`);
        } catch (e) { /* ignore */ }

        joinedRoom = false;
        gamePin = null;
        localSlot = null;
        serverRoomState = null;

        // clear pending PIN and UI
        setPendingJoinPin(null);
        clearJoinPendingNote();
        updateJoinInputVisibility();
        return;
      }

      // If not joined yet: cancel pending pin and, if a ship is selected, create your own room
      const shipId = player1Select ? player1Select.value : null;
      setPendingJoinPin(null);
      clearJoinPendingNote();
      if (joinInput) joinInput.value = '';

      if (!joinedRoom && shipId) {
        // Create own room now (user cancelled attempting to join)
        const shipObj = ships.find(s => String(s.ship_id) === String(shipId));
        if (shipObj) {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const spectate = urlParams.get('spectateVis') ?? 'PUBLIC';
            const joinVis = urlParams.get('joinVis') ?? 'PRIVATE';
            await createWaitingRoomOnServer(spectate, joinVis, shipObj);
          } catch (err) {
            showJoinNote(err.message || String(err), true);
            console.error('Failed to create waiting room after cancelling join:', err);
          }
        }
      } else {
        updateJoinInputVisibility();
      }
    });
  }

  // main flow after ships load
  loadShips().then(() => {
    const player1Select = document.getElementById('player1-select');
    const player2Select = document.getElementById('player2-select');

    if (player1Select) {
      player1Select.addEventListener('change', async (e) => {
        const shipId = e.target.value;
        if (!shipId) {
          selectShip('player1', null);
          return;
        }
        selectShip('player1', shipId);
        const shipObj = ships.find(s => String(s.ship_id) === String(shipId));
        if (!joinedRoom) {
          // If there's a pending join PIN in the query string (legacy), keep that behavior
          const joinPinParams = new URLSearchParams(window.location.search);
          const joinPinParam = joinPinParams.get('join') || joinPinParams.get('gamePin');
          if (joinPinParam) {
            try {
              await joinWaitingRoomOnServer(joinPinParam, shipObj);
              playerToken = getPlayerToken();
            } catch (err) {
              console.error('Failed to join waiting room:', err);
              showError(err.message || String(err));
            }
            return;
          }

          // If user previously pasted a PIN into the join input, pendingJoinPin is set and join will be attempted automatically by selectShip()
          // Otherwise create a waiting room (host)
          if (!pendingJoinPin) {
            const urlParams = new URLSearchParams(window.location.search);
            const spectate = urlParams.get('spectateVis') ?? 'PUBLIC';
            const joinVis = urlParams.get('joinVis') ?? 'PRIVATE';
            try {
              await createWaitingRoomOnServer(spectate, joinVis, shipObj);
            } catch (err) {
              console.error('Failed to create waiting room:', err);
              showError(err.message || String(err));
            }
          }
        } else {
          // already in a room — broadcast change
          sendSelectShipToServer(shipObj);
        }
      });
    }

    // Ready button wiring
    const localReadyBtn = document.getElementById('local-ready-btn');
    if (localReadyBtn) {
      localReadyBtn.addEventListener('click', () => {
        if (localReadyBtn.disabled) return;
        const room = serverRoomState;
        const mySlot = getPlayerSlotForToken(room, playerToken);
        const currentlyReady = room && mySlot && room[mySlot] ? room[mySlot].ready : false;
        toggleReadyStateOnServer(!currentlyReady);
      });
    }

    const battleBtn = document.getElementById('battle-btn');
    if (battleBtn) {
      battleBtn.addEventListener('click', () => requestStartGame());
    }

    // If URL includes join pin, prefill join input and set pending join (but do not auto-join until ship is selected)
    const joinPinParamsOuter = new URLSearchParams(window.location.search);
    const joinPinParamOuter = joinPinParamsOuter.get('join') || joinPinParamsOuter.get('gamePin');
    if (joinPinParamOuter) {
      setPendingJoinPin(joinPinParamOuter);
      const joinInputEl = document.getElementById('join-pin-input');
      if (joinInputEl) joinInputEl.value = joinPinParamOuter;
      updateJoinInputVisibility();
      // show a small note to the user
      const leftSection = document.querySelector('#player1-ship-selection');
      if (leftSection) {
        const note = document.createElement('div');
        note.className = 'dialogue';
        note.textContent = `Joining room ${joinPinParamOuter}. Select your ship to join.`;
        leftSection.appendChild(note);
      }
    }

    if (player2Select) player2Select.disabled = true;
    // initial join input visibility
    updateJoinInputVisibility();

  }).catch(err => {
    console.warn('loadShips() failed:', err);
  });
});


// Add bounce effects when dots get hit
function triggerBounce(dotClass) {
  const dot = document.querySelector(dotClass);
  if (dot) {
    dot.classList.add('hit');
    dot.classList.add('under-attack');

    // Remove hit effect after bounce
    setTimeout(() => {
      dot.classList.remove('hit');
    }, 600);

    // Remove under-attack effect after a random time
    setTimeout(() => {
      dot.classList.remove('under-attack');
    }, 800 + Math.random() * 400);
  }
}

// Create particle explosion effect at specific location
function createExplosionAtDot(dotClass) {
  const dot = document.querySelector(dotClass);
  if (!dot) return;

  const explosion = document.createElement('div');
  explosion.className = 'explosion';

  // Position explosion at the dot's location
  const rect = dot.getBoundingClientRect();
  explosion.style.position = 'fixed';
  explosion.style.left = rect.left + rect.width / 2 + 'px';
  explosion.style.top = rect.top + rect.height / 2 + 'px';
  explosion.style.transform = 'translate(-50%, -50%)';

  document.body.appendChild(explosion);

  // Create multiple particles with random directions
  for (let i = 0; i < 15; i++) {
    const particle = document.createElement('div');
    particle.className = 'explosion-particle';

    // Random explosion colors (only warm colors: red, orange, yellow, white)
    const colors = ['#ff4500', '#ff6347', '#ff6b35', '#ff8c00', '#ffa500', '#ffd700', '#ffff00', '#ffffff'];
    const selectedColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.background = selectedColor;
    particle.style.boxShadow = `0 0 8px ${selectedColor}`;
    // Ensure no blue colors can be applied
    particle.style.setProperty('--particle-color', selectedColor);

    // Random explosion direction and distance
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const distance = 30 + Math.random() * 50;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    particle.style.setProperty('--x', `${x}px`);
    particle.style.setProperty('--y', `${y}px`);

    explosion.appendChild(particle);
  }

  // Remove explosion after animation
  setTimeout(() => {
    document.body.removeChild(explosion);
  }, 2000);
}

// Trigger bounces and explosions when lasers reach their targets
setInterval(() => {
  // Player hits CPU at 0.6s into the 3s cycle
  setTimeout(() => {
    triggerBounce('.player-dot.right');
    createExplosionAtDot('.player-dot.right');
  }, 600);
}, 3000);

setInterval(() => {
  // CPU hits Player at 2.1s into the 3s cycle (1.5s delay + 0.6s travel)
  setTimeout(() => {
    triggerBounce('.player-dot.left');
    createExplosionAtDot('.player-dot.left');
  }, 2100);
}, 3000);
