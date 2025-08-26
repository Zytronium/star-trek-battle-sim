(function () {
  const MODE_KEY = 'stbe_lastMode';
  const defaultMode = 'singleplayer';

  // Elements
  const modeButtons = Array.from(document.querySelectorAll('.mode-card'));
  const prepareBtn = document.getElementById('prepare-btn');

  // Toggle inputs
  const spectateSingleInput = document.getElementById('spectate-single');
  const spectateMultiInput = document.getElementById('spectate-multi');
  const privateMultiInput = document.getElementById('private-multi');

  // Visual switches (for styling)
  const switchSpectateSingle = document.getElementById('switch-spectate-single');
  const switchSpectateMulti = document.getElementById('switch-spectate-multi');
  const switchPrivateMulti = document.getElementById('switch-private-multi');

  // Load saved mode preference or default
  const savedMode = localStorage.getItem(MODE_KEY) || defaultMode;

  function setSelectedMode(mode, { save = true } = {}) {
    modeButtons.forEach(card => {
      const isSelected = card.dataset.mode === mode;
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
    if (save) localStorage.setItem(MODE_KEY, mode);
  }

  // Initialize selection
  setSelectedMode(savedMode, { save: false });

  // Click/keyboard handlers for cards (cards are role=radio)
  modeButtons.forEach(card => {
    card.addEventListener('click', () => {
      setSelectedMode(card.dataset.mode);
    });

    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        card.click();
      }
    });
  });

  // Prevent toggle clicks from propagating to the card click which would change selection unintentionally
  [spectateSingleInput, spectateMultiInput, privateMultiInput].forEach(inp => {
    inp.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    inp.addEventListener('keydown', (e) => e.stopPropagation());
  });

  // Keep the visual switch in-sync with the checkbox state
  function updateSwitchVisual(switchEl, checkbox) {
    if (checkbox.checked) {
      switchEl.classList.add('checked');
    } else {
      switchEl.classList.remove('checked');
    }
  }

  // init visuals from defaults
  updateSwitchVisual(switchSpectateSingle, spectateSingleInput);
  updateSwitchVisual(switchSpectateMulti, spectateMultiInput);
  updateSwitchVisual(switchPrivateMulti, privateMultiInput);

  // update visuals on change
  spectateSingleInput.addEventListener('change', () => updateSwitchVisual(switchSpectateSingle, spectateSingleInput));
  spectateMultiInput.addEventListener('change', () => updateSwitchVisual(switchSpectateMulti, spectateMultiInput));
  privateMultiInput.addEventListener('change', () => updateSwitchVisual(switchPrivateMulti, privateMultiInput));

  // Prepare button: read selected mode and the toggles for that card, then navigate
  prepareBtn.addEventListener('click', () => {
    const selectedCard = modeButtons.find(c => c.classList.contains('selected') || c.getAttribute('aria-checked') === 'true');
    const mode = (selectedCard && selectedCard.dataset.mode) || defaultMode;

    if (mode === 'singleplayer') {
      // singleplayer has only spectate toggle
      const spectateVis = spectateSingleInput.checked ? 'PUBLIC' : 'PRIVATE';
      window.location.href = `/setup/singleplayer?spectateVis=${spectateVis}`;
    } else if (mode === 'multiplayer') {
      const spectateVis = spectateMultiInput.checked ? 'PUBLIC' : 'PRIVATE';
      const joinVis = privateMultiInput.checked ? 'PRIVATE' : 'PUBLIC';
      window.location.href = `/setup/multiplayer?joinVis=${joinVis}&spectateVis=${spectateVis}`;
    } else {
      window.location.href = '/setup';
    }
  });

  // Optional: arrow-key navigation between cards (radiogroup behavior)
  const grid = document.getElementById('modeGrid');
  grid.addEventListener('keydown', (ev) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(ev.key)) return;
    ev.preventDefault();
    const currentIndex = modeButtons.findIndex(b => b.classList.contains('selected'));
    let nextIndex = currentIndex;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') nextIndex = Math.min(modeButtons.length - 1, currentIndex + 1);
    if (nextIndex !== currentIndex) {
      modeButtons[nextIndex].focus();
      setSelectedMode(modeButtons[nextIndex].dataset.mode);
    }
  });

  // A11y: ensure toggles are focusable by keyboard
  [spectateSingleInput, spectateMultiInput, privateMultiInput].forEach(inp => {
    inp.tabIndex = 0;
  });
})();