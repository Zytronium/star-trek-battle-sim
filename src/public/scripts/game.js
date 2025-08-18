// Connect Socket.IO via CDN script
const socket = io();

// ================ Helpers ================ \\

function qs(sel) {
  return document.querySelector(sel);
}

function pct(num, den) {
  if (!den || den <= 0) return 0;
  const v = Math.max(0, Math.min(100, (num / den) * 100));
  return v;
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Update a side panel (stats + bars)
function updateSidePanel(prefix, data) {
  // prefix: 'p' or 'c'
  qs(`#${prefix}-name`).textContent = data.baseStats.name ?? `Ship ${data.ship_id}`;
  qs(`#${prefix}-class`).textContent = data.baseStats.class ?? '—';
  qs(`#${prefix}-owner`).textContent = data.baseStats.owner ?? '—';
  qs(`#${prefix}-registry`).textContent = data.baseStats.registry ?? '—';

  const shieldsNow = data.state?.shield_hp ?? 0;
  const shieldsMax = data.baseStats?.shield_strength ?? 1000;
  const hullNow = data.state?.hull_hp ?? 0;
  const hullMax = data.baseStats?.hull_strength ?? 1000;

  qs(`#${prefix}-shields-val`).textContent = `${Math.max(0, Math.floor(shieldsNow))}/${Math.floor(shieldsMax)}`;
  qs(`#${prefix}-hull-val`).textContent = `${Math.max(0, Math.floor(hullNow))}/${Math.floor(hullMax)}`;

  qs(`#${prefix}-shields-fill`).style.width = `${pct(shieldsNow, shieldsMax)}%`;
  qs(`#${prefix}-hull-fill`).style.width = `${pct(hullNow, hullMax)}%`;

  // todo: set ship image SRC for side panels
}


// Update the center display cards (image + name)
function updateCenterCards(prefix, data) {
  // prefix: 'p' or 'c'
  const imgEl = qs(`#${prefix}-image`);
  const nameEl = qs(`#${prefix}-name-center`);

  nameEl.textContent = data.name ?? `Ship ${data.ship_id}`;
  if (data.image_src) {
    imgEl.src = data.image_src;
    imgEl.style.display = 'block';
  } else {
    imgEl.removeAttribute('src');
    imgEl.style.display = 'none';
  }
}

// Build weapon buttons for the player's ship
function renderWeaponButtons(weapons, onClick) {
  const bar = qs('#weapon-buttons');
  bar.innerHTML = '';
  weapons.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'weapon-button';
    btn.textContent = w.name ?? `Weapon ${w.weapon_id}`;
    btn.title = [
      w.special_effects ? `✨ ${w.special_effects}` : '',
      w.damage != null ? `💥 Damage: ${w.damage}` : '',
      w.hull_multiplier != null ? `🛠 Hull x${w.hull_multiplier}` : '',
      w.shields_multiplier != null ? `🛡 Shields x${w.shields_multiplier}` : ''
    ].filter(Boolean).join(' • ');
    btn.addEventListener('click', () => onClick(w));
    bar.appendChild(btn);
  });
}

// Map a basic gameState ship entry + full details into a unified object
function hydrateShip(base, full) {
  // prefer live values from base (if your engine adds them), fall back to DB
  const obj = {
    ship_id: base.ship_id,
    name: full?.name ?? base.name,
    class: full?.class ?? base.class,
    owner: full?.owner ?? base.owner,
    registry: full?.registry ?? base.registry,
    image_src: full?.image_src ?? base.image_src,
    // live values prefer base (game state), otherwise DB max values
    shields_now: base?.shields_now ?? base?.shields ?? full?.shield_strength ?? 0,
    shields_max: full?.shield_strength ?? base?.shields_max ?? 1000,
    hull_now: base?.hull_now ?? base?.hull ?? full?.hull_strength ?? 0,
    hull_max: full?.hull_strength ?? base?.hull_max ?? 1000
  };
  return obj;
}

// ================ Main live page logic ================ \\

let gameId = null;
let playerToken = null; // if/when you enforce tokens, you can thread it in here

// If this page is opened with `?gameId=...`, treat it as spectate/join.
// Otherwise, you can programmatically navigate from the selection page.
document.addEventListener('DOMContentLoaded', async () => {
  gameId = getQueryParam('gameId');
  if (!gameId) {
    // For spectate links using `/spectate?id=`, support that too:
    gameId = getQueryParam('id');
  }

  // Spectate link copy
  qs('#copy-spectate').addEventListener('click', () => {
    if (!gameId) {
      alert('Unable to generate spectate link: No game ID found');
      return;
    }
    const url = `${window.location.origin}/game/spectate?id=${gameId}`;
    try {
      navigator.clipboard.writeText(url)
        .then(() => {
          console.log("Spectate link copied:", url);
          alert("Spectate link copied to clipboard.");
        })
        .catch(err => {
          console.error(`Failed to copy spectate link "${url}":`, err);
          alert(`Failed to copy to clipboard. Manually copy this: ${url}`);
        });
    } catch (err) {
      console.error(`Failed to copy spectate link "${url}":`, err);

      let message = `Failed to copy to clipboard. Manually copy this: ${url}`;

      // Suggest HTTPS if the current page is not secure
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        message += "\n\nTip: Your connection is not secure. Try switching URL to HTTPS for clipboard support.";
      }

      // Suggest localhost if using 0.0.0.0
      if (window.location.hostname === '0.0.0.0') {
        message += "\n\nTip: You are using 0.0.0.0. Try using http://localhost instead.";
      }

      // Warn that this link only works on your device
      if (['localhost', '0.0.0.0'].includes(window.location.hostname)) {
        message += `\n\nNote: You are locally hosting this website. This link only works on your device. Try \`ip addr show\` in Linux terminal and replacing ${window.location.hostname} with your IP.`
      }

      alert(message);
    }

  });

  // Join the Socket.IO room as soon as possible
  if (gameId) {
    socket.emit('joinGame', gameId);
  }

  // Listen for server pushes
  socket.on('gameUpdate', (gameState) => {
    const playerShip = gameState.ships.find(s => s.pilot === 'P1');
    const cpuShip = gameState.ships.find(s => s.pilot !== 'P1');

    // Use baseStats for design-time info (weapons, names, hull capacity, etc.)
    updateSidePanel('p', playerShip);
    updateSidePanel('c', cpuShip);

    // Render weapon buttons using baseStats
    renderWeaponButtons(playerShip.baseStats.weapons, (w) => {
      socket.emit('playerIntent', {
        gameId: gameState.gameId,
        intent: {
          attacker: playerShip.pilot,
          weapon_id: w.weapon_id,
          target: cpuShip.pilot
        }
      });
    });
  });

});

// Update top bar (last log + turn)
function updateTopBar(gameState) {
  const logs = Array.isArray(gameState.logs) ? gameState.logs : [];
  const last = logs[logs.length - 1] || '--';
  qs('#last-update').textContent = last;
  qs('#turn-indicator').textContent = typeof gameState.turn === 'number'
    ? `Turn: ${gameState.turn}`
    : '';
}
