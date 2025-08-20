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
      w.special_effects ? `✨ Special FX: ${w.special_effects}` : '',
      w.damage != null ? `💥 Damage: ${fmt(w.damage * (w.damage_multiplier ?? 1))}` : '',
      w.hull_multiplier != null ? `🛠 Hull x${fmt(w.hull_multiplier)}` : '',
      w.shields_multiplier != null ? `🛡 Shields x${fmt(w.shields_multiplier)}` : ''
    ].filter(Boolean).join(' • ');
    btn.addEventListener('click', () => onClick(w));
    bar.appendChild(btn);
  });
}

// Helper function to format numbers
function fmt(num, decimals = 4) {
  if (num == null)
    return '--';
  return Number(Number(num).toFixed(decimals));
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
          let message = "Spectate link copied to clipboard.";
          // Warn that this link only works on your device
          if (['localhost', '0.0.0.0'].includes(window.location.hostname)) {
            message += `\n\nNote: You are locally hosting this website. This link only works on your device. Try \`ip addr show\` in Linux terminal and replacing ${window.location.hostname} with your IP. Then, others on your network can spectate.`
          }
          alert(message);
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
        message += `\n\nNote: You are locally hosting this website. This link only works on your device. Try \`ip addr show\` in Linux terminal and replacing ${window.location.hostname} with your IP. Then, others on your network can spectate.`
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
    const target = gameState.logs.length === 1
      ? "NONE"
      : gameState.logs[gameState.logs.length - 1].action.target;

    const targetDot = target.toUpperCase() === "P1" ? "left" : "right";

    if (target !== "NONE") {
      const attackBar = document.getElementById("attack-bar");
      if (attackBar) {
        const phaserBlue = document.createElement("div");
        phaserBlue.className = "phaser-beam player-phaser blue-phaser";
        phaserBlue.style.animationDelay = "0.2s";

        const phaserSilver = document.createElement("div");
        phaserSilver.className = "phaser-beam player-phaser silver-phaser";
        phaserSilver.style.animationDelay = "0.4s";

        const phaserRed = document.createElement("div");
        phaserRed.className = "phaser-beam cpu-phaser cpu-phaser-1";
        phaserRed.style.animationDelay = "0.3s";

        if (targetDot === "right") {
          attackBar.append(phaserBlue, phaserSilver);

          setTimeout(() => {
            phaserBlue.remove();
            phaserSilver.remove();
          }, 1500);

        } else {
          attackBar.append(phaserRed);

          setTimeout(() => {
            phaserRed.remove();
          }, 1500);
        }
      }

      // Update side panels and visualize explosions
      setTimeout(() => {
        updateSidePanel('p', playerShip);
        updateSidePanel('c', cpuShip);

        triggerBounce(`.player-dot.${targetDot}`);
        createExplosionAtDot(`.player-dot.${targetDot}`);
      }, targetDot === "right" ? 700 : 900);
    }

    // Populate side panels on turn 1
    if (target === "NONE") {
      updateSidePanel('p', playerShip);
      updateSidePanel('c', cpuShip);
    }

    // Set ship images if not already loaded (i.e. turn 1 or page reload)
    const playerShipImg = document.getElementById('p-image');
    const cpuShipImg = document.getElementById('c-image');
    if (!playerShipImg.src) {
      // Fetch and set player ship image
      fetch(`/api/shipImg/${playerShip.ship_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.src) playerShipImg.src = `/${data.src}`;
        })
        .catch(err => console.error("Failed to load player ship image:", err));
    }
    if (!cpuShipImg.src) {
      // Fetch and set CPU ship image
      fetch(`/api/shipImg/${cpuShip.ship_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.src) cpuShipImg.src = `/${data.src}`;
        })
        .catch(err => console.error("Failed to load CPU ship image:", err));
    }

    updateTopBar(gameState);

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

  socket.on('errorMessage', (errorMessage) => {
    alert(`Game Error: ${errorMessage}`);
  });

});

// Update top bar (last log + turn)
function updateTopBar(gameState) {
  const logs = Array.isArray(gameState.logs) ? gameState.logs : [];
  const last = logs[logs.length - 1].message || '--';
  qs('#last-update').textContent = last;
  qs('#turn-indicator').textContent = typeof gameState.turn === 'number'
    ? `Turn: ${gameState.turn}`
    : '';
}

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
