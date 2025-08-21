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

// Helper function to format numbers
function fmt(num, decimals = 3) {
  if (num == null) return '--';
  return Number(Number(num).toFixed(decimals));
}

// ======= Client-side lock for weapon buttons ======= \\
let weaponButtonsLockedUntil = 0; // timestamp (ms) until which the client forces weapon buttons disabled
let weaponUnlockTimeout = null;   // timeout id for clearing the lock

// ======= Latest server snapshot (client-side) ======= \\
let latestGameState = null;
let latestPlayerShip = null;
let latestCpuShip = null;

// Helper to send intent using the latest snapshot (avoids stale closures)
function sendIntentUsingLatest(w) {
  if (!latestGameState || !latestPlayerShip || !latestCpuShip) return;
  socket.emit('playerIntent', {
    gameId: latestGameState.gameId,
    intent: {
      attacker: latestPlayerShip.pilot,
      weapon_id: w.weapon_id,
      target: latestCpuShip.pilot
    }
  });
}

// ================ UI Updaters ================ \\

// Update a side panel (stats + bars)
// prefix: 'p' or 'c', data: runtime game ship object (contains baseStats & state)
function updateSidePanel(prefix, data, gameOver = false) {
  // header: show ship name with pilot suffix on H2
  const header = qs(`#${prefix === 'p' ? 'player-panel' : 'cpu-panel'} h2`);
  const shipName = data?.baseStats?.name ?? `Ship ${data?.ship_id ?? '?'}`;
  const pilotLabel = (data?.pilot ?? '').toUpperCase() === 'P1' ? '(P1)' : '(CPU1)';
  if (header) header.textContent = `${shipName} ${pilotLabel}`;

  console.log(data);
  console.log(shipName);
  console.log(`${shipName} ${pilotLabel}`)
  console.log(header);

  qs(`#${prefix}-class`).textContent = data?.baseStats?.class ?? '—';
  qs(`#${prefix}-owner`).textContent = data?.baseStats?.owner ?? '—';
  qs(`#${prefix}-registry`).textContent = data?.baseStats?.registry ?? '—';

  const shieldsNow = data?.state?.shield_hp ?? 0;
  const shieldsMax = data?.baseStats?.shield_strength ?? 1000;

  const hullNow = data?.state?.hull_hp ?? 0;
  const hullMax = data?.baseStats?.hull_strength ?? 1000;

  const shieldsPct = Math.round(pct(shieldsNow, shieldsMax));
  const hullPct = Math.round(pct(hullNow, hullMax));

  qs(`#${prefix}-shields-val`).textContent = `${Math.max(0, Math.ceil(shieldsNow))}/${Math.floor(shieldsMax)} (${shieldsPct}%)`;
  qs(`#${prefix}-hull-val`).textContent = `${Math.max(0, Math.ceil(hullNow))}/${Math.floor(hullMax)} (${hullPct}%)`;

  qs(`#${prefix}-shields-fill`).style.width = `${pct(shieldsNow, shieldsMax)}%`;
  qs(`#${prefix}-hull-fill`).style.width = `${pct(hullNow, hullMax)}%`;

  // armor showing
  const hullArmorBase = data.baseStats?.defenses?.find(d => d.type?.toLowerCase()?.includes('armor'));
  const hullArmorState = data.state?.defenses?.find(d => d.type?.toLowerCase()?.includes('armor'));
  const armorContainer = qs(`#${prefix}-armor-container`);
  if (hullArmorBase) {
    armorContainer.classList.remove('hidden');
    const armorNow = hullArmorState?.hit_points ?? 0;
    const armorMax = hullArmorBase?.hit_points ?? 0;
    qs(`#${prefix}-armor-val`).textContent = `${Math.max(0, Math.ceil(armorNow))}/${Math.floor(armorMax)}`;
    qs(`#${prefix}-armor-fill`).style.width = `${pct(armorNow, armorMax)}%`;
  } else {
    armorContainer.classList.add('hidden');
  }
}

// Build weapon buttons for the player's ship
function renderWeaponButtons(playerShip, onClick, disableAll = false) {
  const bar = qs('#weapon-buttons');
  bar.innerHTML = '';

  if (!playerShip || !playerShip.baseStats) return;

  // Build map of weapon state by weapon_id for quick lookup
  const weaponStateMap = {};
  (playerShip.state?.weapons || []).forEach(ws => {
    weaponStateMap[ws.weapon_id] = ws;
  });

  (playerShip.baseStats?.weapons || []).forEach(w => {
    const state = weaponStateMap[w.weapon_id] || {
      usage_left: w.max_usage ?? 0,
      cooldown_left: 0
    };
    const maxUsage = ((w.max_usage == null || w.max_usage >= 99999) ? Infinity : w.max_usage);
    const usesLeft = state.usage_left == null ? (maxUsage === Infinity ? '∞' : maxUsage) : state.usage_left;
    const cooldownLeft = state.cooldown_left ?? 0;
    const cooldownTurns = w.cooldown_turns ?? 0;

    const btn = document.createElement('button');
    btn.className = 'weapon-button';
    // accessible name
    btn.setAttribute('aria-label', w.name ?? `Weapon ${w.weapon_id}`);

    // tooltip content (description + special effects)
    const tooltipParts = [];
    if (w.description) tooltipParts.push(w.description);
    if (w.special_effects) tooltipParts.push(`Special: ${w.special_effects}`);
    // add extra info to tooltip
    tooltipParts.push(`Max uses: ${maxUsage === Infinity ? '∞' : maxUsage}`);
    tooltipParts.push(`Cooldown: ${cooldownTurns} turn(s)`);

    btn.dataset.tooltip = tooltipParts.join('\n');

    // top line: weapon name
    const nameLine = document.createElement('div');
    nameLine.style.fontWeight = 700;
    nameLine.textContent = w.name ?? `Weapon ${w.weapon_id}`;

    // meta row with uses/cooldown/damage
    const metaRow = document.createElement('div');
    metaRow.className = 'weapon-meta';

    const leftMeta = document.createElement('div');
    leftMeta.innerHTML = `<span class="pill">Uses: ${(maxUsage !== Infinity ? `${usesLeft} / ${maxUsage}` : '∞')}</span>`;

    const rightMeta = document.createElement('div');
    rightMeta.innerHTML = `<span class="pill">CD: ${cooldownLeft}/${cooldownTurns}</span>`;

    const damageMeta = document.createElement('div');
    damageMeta.style.marginTop = '6px';
    damageMeta.style.fontSize = '0.86rem';
    damageMeta.style.opacity = '0.95';
    const dmg = w.damage ?? 0;
    const dmgMult = w.damage_multiplier ?? 1;
    const shieldsMult = w.shields_multiplier ?? 1;
    const hullMult = w.hull_multiplier ?? 1;
    damageMeta.textContent = `Base: ${fmt(dmg*dmgMult)} | Shields: ×${fmt(shieldsMult)} • Hull: ×${fmt(hullMult)}`;

    metaRow.appendChild(leftMeta);
    metaRow.appendChild(rightMeta);

    btn.appendChild(nameLine);
    btn.appendChild(metaRow);
    btn.appendChild(damageMeta);

    // disable conditions: globally disabled, or on cooldown, or out of uses
    const noUses = (state.usage_left !== undefined && state.usage_left <= 0);
    const onCooldown = (state.cooldown_left && state.cooldown_left > 0);

    // Respect client-side lock timestamp as a disable condition so the UI is consistent
    const clientLocked = Date.now() < weaponButtonsLockedUntil;

    // Also respect server-side game-over even if client lock expired
    const serverGameOver = !!(latestGameState && latestGameState.winner);

    if (disableAll || clientLocked || noUses || onCooldown || serverGameOver) {
      btn.disabled = true;
      // small indicator (append a pill)
      const statusPill = document.createElement('span');
      statusPill.className = 'pill';

      if (serverGameOver) statusPill.textContent = 'Game over';
      else if (noUses) statusPill.textContent = 'No uses';
      else if (onCooldown) statusPill.textContent = `Cooldown: ${state.cooldown_left}`;
      else if (clientLocked) statusPill.textContent = 'Waiting...';
      else statusPill.textContent = 'Locked';
      statusPill.style.marginTop = '6px';
      btn.appendChild(statusPill);
    }

    // When clicked: set the client lock immediately, re-render to show disabled state,
    // then call the provided onClick (which emits the intent).
    btn.addEventListener('click', () => {
      if (!btn.disabled) {
        // set client lock for 2.5s
        weaponButtonsLockedUntil = Date.now() + 2500;

        // clear existing unlock timer if any
        if (weaponUnlockTimeout) {
          clearTimeout(weaponUnlockTimeout);
          weaponUnlockTimeout = null;
        }

        // schedule unlock re-render so buttons reliably re-enable even if no server update arrives
        if (weaponButtonsLockedUntil !== Infinity) {
          const remaining = Math.max(0, weaponButtonsLockedUntil - Date.now());
          weaponUnlockTimeout = setTimeout(() => {
            weaponUnlockTimeout = null;

            // If the server reports game over in the meantime, keep them locked.
            if (latestGameState && latestGameState.winner) {
              weaponButtonsLockedUntil = Infinity;
              // ensure UI reflects permanent lock
              renderWeaponButtons(latestPlayerShip || playerShip, onClick, true);
              return;
            }

            // Normal unlock path
            weaponButtonsLockedUntil = 0;
            // re-render using the latest snapshot so cooldown labels reflect server state
            renderWeaponButtons(latestPlayerShip || playerShip, onClick, false);
          }, remaining);
        }
        // re-render immediately to reflect the locked UI using the latest snapshot
        renderWeaponButtons(latestPlayerShip || playerShip, onClick, true);

        // finally, call the provided click handler (send intent) — onClick should be a function
        // that uses latest snapshots (we pass sendIntentUsingLatest from gameUpdate)
        onClick(w);
      }
    });

    bar.appendChild(btn);
  });
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
  const copyBtn = qs('#copy-spectate');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!gameId) {
        alert('Unable to generate spectate link: No game ID found');
        return;
      }
      const url = `${window.location.origin}/game/spectate?id=${gameId}`;
      try {
        navigator.clipboard.writeText(url).then(() => {
          alert("Spectate link copied to clipboard.");
        }).catch(() => {
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
  }

  // Join the Socket.IO room as soon as possible
  if (gameId) {
    socket.emit('joinGame', gameId);
  }

  // Listen for server pushes
  socket.on('gameUpdate', (gameState) => {
    // update latest snapshot references first (so render/send use newest data)
    latestGameState = gameState;
    latestPlayerShip = gameState.ships.find(s => s.pilot === 'P1');
    latestCpuShip = gameState.ships.find(s => s.pilot !== 'P1');

    const playerShip = latestPlayerShip;
    const cpuShip = latestCpuShip;

    // protect against missing data
    if (!playerShip || !cpuShip) return;

    const target = gameState.logs.length === 1
      ? "NONE"
      : gameState.logs[gameState.logs.length - 1].action.target ?? "NONE";

    const targetDot = (String(target).toUpperCase() === "P1" ? "left" : "right");
    const lastLog = gameState.logs.length > 0 ? gameState.logs[gameState.logs.length - 1] : null;
    const weaponId = lastLog?.action?.weapon_id;

    // categorize weapons manually
    // Beam weapons (phasers, disruptors, energy weapons)
    const beamWeapons = [
      3,  // Phaser Array
      5,  // Disruptor Arrays
      8,  // Large Disruptor
      9,  // Phased Polaron Beams
      12, // Energy Dissipater
      13, // Heavy Phaser Arrays
      15, // Mycelial Energy Projector
      16, // Tribble (because it needs to have an animation)
    ];

    // Projectile weapons (torpedoes, charges, warheads)
    const projectileWeapons = [
      0,  // Photon Torpedoes
      1,  // Quantum Torpedoes
      2,  // Torpedoes (standard)
      4,  // Phaser Cannons
      6,  // Disruptor Cannons
      10, // Spatial Charges
      11, // Tricobalt Warheads
      14, // Large Phaser Cannons
    ];

    // 7 is not listed, as it is the "Unknown (invalid)" weapon.

    const attackBar = document.getElementById("attack-bar");

    // show weapon buttons immediately (use sendIntentUsingLatest so clicks always use fresh data)
    const gameOver = !!gameState.winner;

    // If the server just reported the game is over, ensure the client lock is permanent and cancel any unlock timer.
    if (gameOver) {
      if (weaponUnlockTimeout) {
        clearTimeout(weaponUnlockTimeout);
        weaponUnlockTimeout = null;
      }
      weaponButtonsLockedUntil = Infinity;
    }

    renderWeaponButtons(playerShip, sendIntentUsingLatest, gameOver);

    // We'll update side panels when the explosion/bounce is played.
    // If no animation will play, update them now.
    let animationWillRun = false;

    // If there is an actual last action and attackBar exists, show animation
    if (target !== "NONE" && attackBar) {
      animationWillRun = true;
      const isBeam = beamWeapons.includes(weaponId);
      const isProjectile = projectileWeapons.includes(weaponId);

      // compute the impact delay used for the visual explosion/bounce
      // (keeps existing behavior: right targets are slightly faster)
      const impactDelayMs = targetDot === "right" ? 700 : 900;

      // ---------- BEAM  ----------
      if (isBeam) {
        if (targetDot === "right") {
          const phaserBlue = document.createElement("div");
          phaserBlue.className = "phaser-beam player-phaser blue-phaser";
          phaserBlue.style.animationDelay = "0.2s";

          const phaserSilver = document.createElement("div");
          phaserSilver.className = "phaser-beam player-phaser silver-phaser";
          phaserSilver.style.animationDelay = "0.4s";

          attackBar.append(phaserBlue, phaserSilver);
          setTimeout(() => {
            phaserBlue.remove();
            phaserSilver.remove();
          }, 1500);
        } else {
          const phaserRed = document.createElement("div");
          phaserRed.className = "phaser-beam cpu-phaser cpu-phaser-1";
          phaserRed.style.animationDelay = "0.3s";
          attackBar.append(phaserRed);
          setTimeout(() => {
            phaserRed.remove();
          }, 1500);
        }
      } else if (isProjectile) {
        // --- Projectile: dot travel tuned to end near player dots ---
        const playerFired = (targetDot === "right");
        const attackW = attackBar.clientWidth || attackBar.offsetWidth || 650;
        const padding = 180; // left+right starting padding
        // travel slightly extra so dot reaches over the bar center and fades after dot location
        const travelPx = Math.max(120, attackW - padding) + 36;

        // choose a duration (shorten to speed up)
        const baseDuration = 0.9; // seconds
        const secondaryOffset = 0.025; // small stagger for second projectile

        // quantum torpedo special case (single silver)
        const isQuantum = (weaponId === 1);

        // main projectile
        const proj = document.createElement("div");
        if (playerFired) {
          proj.className = `projectile player${isQuantum ? " silver" : ""}`;
          proj.style.left = "90px";
        } else {
          proj.className = `projectile cpu${isQuantum ? " silver" : ""}`;
          proj.style.right = "90px";
        }
        proj.style.top = "20px";
        proj.style.setProperty('--travel', (playerFired ? `${travelPx}px` : `-${travelPx}px`));
        proj.style.animationDuration = `${baseDuration}s`;
        attackBar.appendChild(proj);

        // second projectile for heavy cannons (not quantum)
        const needsSecond = (!isQuantum && (weaponId === 4 || weaponId === 6 || weaponId === 14));
        if (needsSecond) {
          const proj2 = document.createElement("div");
          // same color as first unless explicitly silver override handled above
          if (playerFired) proj2.className = `projectile player player-2`;
          else proj2.className = `projectile cpu cpu-2`;
          if (playerFired) proj2.style.left = "90px"; else proj2.style.right = "90px";
          proj2.style.top = "32px";
          proj2.style.setProperty('--travel', (playerFired ? `${travelPx}px` : `-${travelPx}px`));
          proj2.style.animationDuration = `${baseDuration + secondaryOffset}s`;
          attackBar.appendChild(proj2);
          setTimeout(() => proj2.remove(), (baseDuration + secondaryOffset) * 1000 + 120);
        }

        // cleanup main projectile slightly after animation
        setTimeout(() => proj.remove(), baseDuration * 1000 + 120);
      }

      // After short delay update UI and show explosion — now update panels at this exact moment
      setTimeout(() => {
        // visual effects
        triggerBounce(`.player-dot.${targetDot}`);
        createExplosionAtDot(`.player-dot.${targetDot}`);

        // update side panels at the exact explosion moment (use latest server-provided states)
        updateSidePanel('p', latestPlayerShip, gameOver);
        updateSidePanel('c', latestCpuShip, gameOver);
      }, impactDelayMs);
    }

    // If no animation will run, update panels immediately so UI stays fresh
    if (!animationWillRun) {
      updateSidePanel('p', latestPlayerShip, gameOver);
      updateSidePanel('c', latestCpuShip, gameOver);
    }

    // update top bar (last log + turn) immediately
    updateTopBar(gameState);

    // load images if missing
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

    // Disable all buttons when game over: renderWeaponButtons already uses gameOver
    // We still ensure anything else is disabled
    if (gameState.winner) {
      document.querySelectorAll('.weapon-button').forEach(b => b.disabled = true);
    }
  });

  socket.on('errorMessage', (errorMessage) => {
    alert(`Game Error: ${errorMessage}`);
  });
});

// Update top bar (last log + turn)
function updateTopBar(gameState) {
  const logs = Array.isArray(gameState.logs) ? gameState.logs : [];
  const last = logs[logs.length - 1] ? (logs[logs.length - 1].message || JSON.stringify(logs[logs.length - 1].action)) : '--';
  qs('#last-update').textContent = last;
  qs('#turn-indicator').textContent = typeof gameState.turn === 'number' ? `Turn: ${gameState.turn}` : '';
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
  for (let i = 0; i < 18; i++) {
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
  }, 2100);
}
