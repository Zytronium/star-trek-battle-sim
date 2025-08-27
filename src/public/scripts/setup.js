let ships = [];
let selectedShips = { player1: null, player2: null };
let weapons = {};
let defenses = {};

// Load ships from API
async function loadShips() {
  try {
    // Fetch all ships
    const response = await fetch('/api/ships');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    ships = await response.json();  // Store all ships

    populateDropdowns();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('battle-interface').style.display = 'block';
  } catch (error) {
    console.error('Error loading ships:', error);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = 'Failed to load ships. Please try again.';
  }
}

// Populate dropdowns with ships
function populateDropdowns() {
  const player1Select = document.getElementById('player1-select');
  const player2Select = document.getElementById('player2-select');

  // Clear existing options (except the first placeholder)
  player1Select.innerHTML = '<option value="">-- Select a ship --</option>';
  player2Select.innerHTML = '<option value="">-- Select a ship --</option>';

  ships.forEach(ship => {
    const option1 = document.createElement('option');
    option1.value = ship.ship_id;
    option1.textContent = `${ship.name} (${ship.class})`;
    option1.dataset.ship = JSON.stringify(ship);

    const option2 = option1.cloneNode(true);
    option2.dataset.ship = JSON.stringify(ship);

    player1Select.appendChild(option1);
    player2Select.appendChild(option2);
  });
}

// Create ship display card
function createShipDisplay(ship) {
  const shieldPercentage = Math.min(100, Math.max(0, (ship.shield_strength / 1000) * 100));
  const healthPercentage = Math.min(100, Math.max(0, (ship.hull_strength / 1000) * 100));

  return `
                <div class="health-bars">
                    <div class="health-bar">
                        <div class="health-bar-label">
                            <span>Shields</span>
                            <span>${ship.shield_strength || 0}</span>
                        </div>
                        <div class="shield-bar">
<!--                            <div class="shield-fill" style="width: ${shieldPercentage}%"></div>--> <!-- during battle, ship should be "shield HP / max shield"-->
                            <div class="shield-fill"></div>
                        </div>
                    </div>
                    <div class="health-bar">
                        <div class="health-bar-label">
                            <span>Hull</span>
                            <span>${ship.hull_strength || 0}</span>
                        </div>
                        <div class="health-bar-red">
<!--                            <div class="health-fill" style="width: ${healthPercentage}%"></div> --> <!-- during battle, ship should be "hull HP / max Hull"-->
                            <div class="health-fill"></div>
                        </div>
                    </div>
                </div>
                <div class="ship-image">
                    <img src="${ship.image_src.startsWith('/') ? ship.image_src : `/${ship.image_src}`}" alt="${ship.name}">
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

// Handle ship selection from dropdown
function selectShip(player, shipId) {
  if (!shipId) {
    // Clear selection
    selectedShips[player] = null;
    document.getElementById(`${player}-ship-display`).style.display = 'none';
    updateBattleButton();
    return;
  }

  // Find the selected ship
  const ship = ships.find(s => s.ship_id == shipId);
  if (ship) {
    selectedShips[player] = ship;

    // Display the selected ship
    const displayElement = document.getElementById(`${player}-ship-display`);
    displayElement.innerHTML = createShipDisplay(ship);
    displayElement.style.display = 'block';

    updateBattleButton();
  }
}

// Update battle button state
function updateBattleButton() {
  const battleBtn = document.getElementById('battle-btn');
  battleBtn.disabled = !(selectedShips.player1 && selectedShips.player2);
}

// Load ships and add change event listeners for dropdowns
document.addEventListener('DOMContentLoaded', () => {
  loadShips();
  document.getElementById('player1-select').addEventListener('change', (e) => selectShip('player1', e.target.value));
  document.getElementById('player2-select').addEventListener('change', (e) => selectShip('player2', e.target.value));
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
