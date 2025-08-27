const { v4: uuidv4 } = require('uuid');
const { activeGames, waitingRooms, getIO } = require('./gameState');
const { inspect } = require("node:util");
const AppService = require('../controllers/appService');

const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

class GameEngine {
  static VALID_TYPES = ["AI V AI", "PLAYER V AI", "PLAYER V PLAYER", "AI V BOSS", "PLAYER V BOSS", "PLAYERS V BOSS"];
  static IMPLEMENTED_TYPES = ["PLAYER V AI", "PLAYER V PLAYER"];

  // ======== Create new game ======== \\
  static async createGame(type, ships, playerTokens, spectatePin, spectateRequiresPin) {
    // ---------- Validate type ---------- //
    if (!type) {
      return { error: true, message: "Missing param 'type'" };
    }
    if (typeof type !== "string") {
      return { error: true, message: "Param 'type' must be a string" };
    }
    if (!this.VALID_TYPES.includes(type.toUpperCase())) {
      return { error: true, message: `Invalid type. Must be one of: ${this.VALID_TYPES.join(", ")}` };
    }
    if (!this.IMPLEMENTED_TYPES.includes(type.toUpperCase())) {
      return { error: true, message: `This type of battle is not implemented yet. Try: ${this.IMPLEMENTED_TYPES.join(", ")}` };
    }

    // ---------- Validate ships ---------- //
    if (!ships) {
      return { error: true, message: "Missing param 'ships'" };
    }
    if (!Array.isArray(ships)) {
      return { error: true, message: "Param 'ships' must be an array" };
    }
    if (ships.length < 2) {
      return {
        error: true,
        message: "Param 'ships' must contain at least 2 ships"
      };
    }

    const shipsCheck = this.validateShips(ships, type);
    if (shipsCheck.error) {
      return { error: true, message: shipsCheck.reason };
    }
    if (!shipsCheck.valid) {
      return {
        error: true,
        message: `Param 'ships' is invalid: ${shipsCheck.reason}`
      };
    }

    // Generate spectate pin if not specified
    if (!spectatePin) {
      do {
        spectatePin = this.randomPin(5);
      } while (
        Object.values(waitingRooms).some(r => r.spectatePin === spectatePin) ||
        Object.values(activeGames).some(g => g.spectatePin === spectatePin)
        );
    }

    // ---------- Build runtime ships ---------- //
    const runtimeShips = [];
    for (const s of ships) {
      const runtimeShip = await this.createRuntimeShip(s.ship_id, s.pilot, s.is_boss);
      runtimeShips.push(runtimeShip);
    }

    // ---------- Create game ---------- //
    const gameId = uuidv4();

    console.log(`Creating game ${gameId} with tokens ${playerTokens}`);
    const gameState = {
      gameId,
      type,
      ships: runtimeShips,
      logs: [`Game created: ${type}`],
      turn: 1,
      playerTurn: 'P1',
      winner: null,
      playerTokens,
      spectatePin,
      spectateRequiresPin
    };

    // Save game in activeGames (retrieve with await GameEngine.getGame(gameId);)
    activeGames[gameId] = gameState;

    // Create a sanitized copy to send to clients (remove any sensitive token info)
    // Shallow clone is fine here because we don't modify nested objects for sanitization,
    // but ensure playerTokens is removed.
    const sanitizedGameState = Object.assign({}, gameState);
    if (sanitizedGameState.playerTokens) delete sanitizedGameState.playerTokens;

    // Broadcast initial (sanitized) game state
    getIO().to(`game-${gameId}`).emit('gameUpdate', sanitizedGameState);

    // Return success including the tokens so server-side caller (controller) can forward the right tokens to the right clients
    return { success: true, gameId, playerTokens, sanitizedGameState };
  }

  // Helper function for creating ships in memory at start of createGame()
  static async createRuntimeShip(ship_id, pilot, is_boss) {
    const shipData = await AppService.getShipFullByID(ship_id);

    return {
      ship_id,
      pilot,
      is_boss,
      baseStats: shipData,  // keep the raw DB stats for reference
      state: {
        shield_hp: shipData.shield_strength,
        hull_hp: shipData.hull_strength,
        weapons: shipData.weapons.map(w => ({
          weapon_id: w.weapon_id,
          cooldown_left: 0,
          usage_left: w.max_usage
        })),
        defenses: shipData.defenses.map(d => ({
          defense_id: d.defense_id,
          type: d.type,
          hit_points: d.hit_points  // for defenses like ablative armor. Does not apply to shields.
        }))
      }
    };
  }

  // Helper function for validating ships in createGame()
  static validateShips(ships, type) {
    let return_value = {
      valid: true,
      reason: "",
      error: false
    };

    try {
      const VALID_SHIP_KEYS = ["ship_id", "pilot", "is_boss"];
      const pilots = [];
      let has_boss = false;

      ships.forEach((ship) => {
        // Check if ship is null
        if (ship === null) {
          return_value = {
            valid: false,
            reason: "At least one ship is null. All ships must be an object."
          };
          return;
        }

        // Check if ship is not an object
        if (typeof ship !== 'object' || Array.isArray(ship)) {
          return_value = {
            valid: false,
            reason: `All ships must be an object${Array.isArray(ship) ? " (not an array)" : ""}.`
          };
          return;
        }

        // Check if any required ship properties are not present and validate their values
        VALID_SHIP_KEYS.forEach((key) => {
          // Ensure all required ship properties are present
          if (!Object.keys(ship).includes(key)) {
            return_value = {
              valid: false,
              reason: `Ship property '${key}' not found in at least one ship. Ship properties must include: ${VALID_SHIP_KEYS.join(", ")}`
            };
            return;
          }
          // Validate key values
          switch (key) {
            case "ship_id": // Validate ship_id
              if (isNaN(parseInt(ship.ship_id))) { // Check if it's not a number
                return_value = {
                  valid: false,
                  reason: `Ship ID ${ship.ship_id} is not a number.`
                };
                return;
              }
              if (ship.ship_id < 0) { // Check if it's negative
                return_value = {
                  valid: false,
                  reason: `Ship ID ${ship.ship_id} cannot be negative.`
                };
                return;
                // Consider adding a check to see if ship ID is out of range, but that would make this have to be an async function and would have to account for whether its a boss or not.
              }
              break;

            case "pilot": // Validate pilot
              if (pilots.includes(ship.pilot.toUpperCase())) { // Check if pilot is repeated in another ship
                return_value = {
                  valid: false,
                  reason: `There cannot be more than one ships piloted by '${ship.pilot.toUpperCase()}'.`
                };
                return;
              }
              pilots.push(ship.pilot.toUpperCase());

              let VALID_PILOTS = [];
              switch (type.toUpperCase()) { // Validate pilot name based on battle type
                case "AI V AI":
                  VALID_PILOTS = ["COM1", "COM2"];
                  break;

                case "PLAYER V AI":
                  VALID_PILOTS = ["P1", "COM1"];
                  break;

                case "PLAYER V PLAYER":
                  VALID_PILOTS = ["P1", "P2"];
                  break;

                case "AI V BOSS":
                  VALID_PILOTS = ["BOSS"];
                  for (let i = 1; i <= 50; i++) {
                    VALID_PILOTS.push(`COM${i}`);
                  }
                  break;

                case "PLAYER V BOSS":
                  VALID_PILOTS = ["BOSS", "P1"];
                  for (let i = 1; i <= 49; i++) {
                    VALID_PILOTS.push(`COM${i}`);
                  }
                  break;


                case "PLAYERS V BOSS":
                  VALID_PILOTS = ["BOSS", "P1", "P2", "P3"]; // Add to this to support more than 3 players in a boss battle.
                  for (let i = 1; i <= 48; i++) {
                    VALID_PILOTS.push(`COM${i}`);
                  }
                  break;

                default:
                  console.error(`Validating ships failed. Game type '${type}' not found even though game type passed previous validation`);
                  return_value = {
                    valid: false,
                    reason: `An error occurred while validating. Game type '${type}' not found even though game type passed previous validation.`,
                    error: true
                  };
                  return;

              }

              if (!VALID_PILOTS.includes(ship.pilot.toUpperCase())) {
                return_value = {
                  valid: false,
                  reason: `No ships can be piloted by '${ship.pilot.toUpperCase()}' in '${type.toUpperCase()}' battles. (Valid pilots: ${VALID_PILOTS.join(", ")})'.)`
                };
                return;
              }
              break;

            case "is_boss":
              if (typeof ship.is_boss !== "boolean") { // Check if is_boss is not a bool
                return_value = {
                  valid: false,
                  reason: "Ship property 'is_boss' must be a boolean."
                };
                return;
              }
              if (ship.is_boss) {
                if (["AI V AI", "PLAYER V AI", "PLAYER V PLAYER"].includes(type.toUpperCase())) { // Check if ship is a boss when type is not a boss battle type
                  return_value = {
                    valid: false,
                    reason: "No ships can be a boss in a non-boss battle."
                  };
                  return;
                }
                if (has_boss) { // Check if there's more than one bosses
                  return_value = {
                    valid: false,
                    reason: "There cannot be more than one boss."
                  };
                  return;
                }
                has_boss = true;
              }
              break;

            default:
              console.error(`Unexpected key '${key}' found when validating ship property values, even though it has already been confirmed that this key does not exist.`);
              return_value = {
                valid: false,
                reason: `An error occurred while validating. Unexpected key '${key}' found when validating ship property values, even though it has already been confirmed that this ship does not contain this property.`,
                error: true
              };
              return;
          }
        });

        // Check for unknown ship properties
        let invalid = false;
        Object.keys(ship).forEach((key) => {
          if (!invalid) { // For some reason, it won't let me use `break`, so I'm using this instead
            if (!VALID_SHIP_KEYS.includes(key)) {
              return_value = {
                valid: false,
                reason: `Unknown ship property '${key}'. Ship properties must be: ${VALID_SHIP_KEYS.join(", ")}`
              };
              invalid = true; // effectively `break;`
            }
          }
        });

      });
    } catch (e) {
      console.error(`An error occurred while validating ships: ${e}`);
      return_value = {
        valid: false,
        reason: "An unexpected error occurred while validating ships.",
        error: true
      };
      return;
    }

    if (return_value.valid) {
      return_value.reason = "No problems found. All ships valid.";
    }

    return return_value;
  }

  // ======== Create waiting room for PvP game ======== \\
  static async createWaitingRoom(spectateVis, joinVis, p1Ship, playerToken) {
    // ---------- Validate spectateVis ---------- //
    if (typeof spectateVis !== "string") {
      throw new Error("Param 'spectateVis' must be a string.");
    }
    if (!["PUBLIC", "PRIVATE"].includes(spectateVis.toUpperCase())) {
      throw new Error("Param 'spectateVis' is invalid. Must be 'PUBLIC' or 'PRIVATE'.");
    }

    // ---------- Validate joinVis ---------- //
    if (typeof joinVis !== "string") {
      throw new Error("Param 'joinVis' must be a string.");
    }
    if (!["PUBLIC", "PRIVATE"].includes(joinVis.toUpperCase())) {
      throw new Error("Param 'joinVis' is invalid. Must be 'PUBLIC' or 'PRIVATE'.");
    }

    // ---------- Validate ship ---------- //
    const shipsCheck = this.validateShips([p1Ship], "PLAYER V PLAYER");
    if (shipsCheck.error) {
      throw new Error(shipsCheck.reason);
    }
    if (!shipsCheck.valid) {
      throw new Error(`Param 'p1Ship' is invalid: ${shipsCheck.reason}`);
    }

    // ---------- Validate playerToken ---------- //
    if (typeof playerToken !== "string") {
      throw new Error("Param 'playerToken' must be a string.");
    }
    if (!playerToken) {
      throw new Error("Param 'playerToken' cannot be empty.");
    }

    // Create a unique game pin and spectate pin
    let gamePin;
    let spectatePin;
    do {
      gamePin = this.randomPin(4);
    } while (waitingRooms[gamePin])
    do {
      spectatePin = this.randomPin(5);
    } while (
      Object.values(waitingRooms).some(r => r.spectatePin === spectatePin) ||
      Object.values(activeGames).some(g => g.spectatePin === spectatePin)
      );


    let waitingRoom = {
      gamePin, // also used as the room ID
      spectatePin,
      p1: { // p1 will be host. Read note below about what this means.
        ship: p1Ship,
        token: playerToken, // NOTE: NEVER send this token to the client!
        ready: false,
        connected: true // Set to false when player's client disconnects if we can even detect that
      },
      p2: null,
      spectateVis: spectateVis.toUpperCase(),
      joinVis: joinVis.toUpperCase()
    };
    // NOTE: P1 will always be the host. While game logic still runs on the
    //       backend, some actions must be only done on one client, not both.
    //       For certain actions, only the host will perform them. For example,
    //       when both players signal they are ready to being the battle, the
    //       host client will send the signal to create and start the game.

    // waitingRooms[gamePin] = waitingRoom;

    let newHostRoom = null;

    // If this is public, try to auto-match
    if (joinVis.toUpperCase() === "PUBLIC") {
      newHostRoom = this.searchWaitingRooms(waitingRoom);
    }

    // If this is still the host room, add it to waitingRooms
    if (!newHostRoom) {
      waitingRooms[gamePin] = waitingRoom;
    } else {
      waitingRoom = newHostRoom;
    }

    return waitingRoom;
  }

  // Helper function to generate a random pin
  static randomPin(length) {
    let max = Math.pow(10, length); // upper bound (exclusive)
    let num = Math.floor(Math.random() * max);
    return String(num).padStart(length, '0'); // keep leading zeros
  }

  // ======== Search for Waiting Rooms and Merge ======== \\
  static searchWaitingRooms(waitingRoom) {
    // Find all waiting rooms whose joinVis = PUBLIC and doesn't have a p2.
    const availableRooms = Object.values(waitingRooms)
      .filter(r => r.joinVis === "PUBLIC") // Anyone can join
      .filter(r => r.p2 === null)          // Waiting for a p2
      .filter(r => r.p1.connected);        // P1 is still there

    // If no rooms are available, return null to indicate none were found
    if (availableRooms.length === 0) {
      return null;
    }

    // Pick a random available room
    const hostRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];

    // Merge: assign this waiting room's p1 as hostRoom.p2
    hostRoom.p2 = waitingRoom.p1;

    // TODO: socket management
    // We'll likely want to do something like:
    // getIO().to(`room-${hostRoom.gamePin}`).emit('waitingRoomUpdated', hostRoom);

    return hostRoom;
  }

  // ======== Get game from ID ======== \\
  static getGame(gameId) {
    return activeGames[gameId];
    // Caller is responsible for checking if a game was found with `if (!game) {}`
  }

  // ======== Get game event logs ======== \\
  static async getEvents(gameId, turn = 0) {
    // Returns all events if `turn` is 0 (default), else, returns event for given turn

    // Ensure turn number is a valid positive number
    if (isNaN(turn) || turn < 0) {
      throw new Error("turn must be a positive number.");
    }

    // Get this game and ensure its valid
    const game = this.getGame(gameId);
    if (!game)
      throw new Error(`Game ${gameId} not found.`);

    // Return all game logs if turn is 0 (default)
    if (turn === 0)
      return game.logs;

    // Ensure turn exists in this game
    if (game.logs.length <= turn) {
      throw new Error(`This game does not have ${turn} turns.`);
    }

    // Return this turn's log
    return game.logs[turn];
  }

  // ======== Process game logic for new turn ======== \\
  static async processTurnIntent(game, intent, token) {
    if (!game) throw new Error("Game object is required");

    if (intent.attacker.toUpperCase().startsWith("P") && (!token || token !== game.playerTokens[intent.attacker.toUpperCase()])) {
      console.warn(
        'UNAUTHORIZED INTENT DETECTED.',
        `Attacker: ${intent.attacker} | Token Supplied: ${token}`
      ); // Aw, don't cry (;
      throw new Error("Unauthorized: Player token is invalid or missing.");
    }

/*    console.log(inspect(game, {
      colors: true, // enable ANSI colors
      depth: null  // unlimited nesting
    }));*/

    // console.log("Attacker ship:", intent.attacker);
    // console.log("Target ship:", intent.target);

    // Find attacker & target in memory
    const attacker = game.ships.find(s => s.pilot.toUpperCase() === intent.attacker.toUpperCase());
    const target   = game.ships.find(s => s.pilot.toUpperCase() === intent.target.toUpperCase());

    if (!attacker) throw new Error("Invalid attacker ship.");
    if (!target) throw new Error("Invalid target ship.");

    // Find weapon in runtime state
    const weaponState = attacker.state.weapons.find(w => w.weapon_id === intent.weapon_id);
    const weaponBase  = attacker.baseStats.weapons.find(w => w.weapon_id === intent.weapon_id);

    if (!weaponState || !weaponBase)
      throw new Error("Weapon not equipped on ship");

    if (weaponState.usage_left <= 0)
      throw new Error("Weapon out of uses");
    if (weaponState.cooldown_left > 0)
      throw new Error(`Weapon still on cooldown (Cooldown turns left: ${weaponState.cooldown_left})`);

    console.log(`Starting turn ${game.turn}`);

    // ================ Damage calculations ================ \\
    const baseDamage = weaponBase.damage * parseFloat(weaponBase.damage_multiplier ?? 1);
    const Sm = parseFloat(weaponBase.shields_multiplier ?? 1);
    const Hm = parseFloat(weaponBase.hull_multiplier ?? 1);
    const bypass = weaponBase.special_effects === 'Partial Shield Bypass' ? 0.8 : 0; // 0..1

    // Portion that goes toward shields, portion that bypasses directly
    const originalShieldHp = target.state.shield_hp;

    // We'll accumulate hull damage here (always multiply by Hm whenever damage actually hits hull)
    let damageToHull = 0;

    // Damage that bypasses shields goes straight to hull and gets the hull multiplier
    if (bypass > 0) {
      damageToHull += baseDamage * bypass * Hm;
    }

    // Damage that is intended to hit shields (reduced by bypass)
    const toShields = baseDamage * Sm * (1 - bypass);

    // Apply shield absorption with effectiveness + low-HP degradation
    for (const defense of target.baseStats.defenses) {
      if (defense.type === 'Shield') {
        // Base effectiveness (e.g., 0.95)
        let eff = parseFloat(defense.effectiveness ?? 1);

        // Low-HP degradation rule:
        // Degrade when <=10% of max.
        // Otherwise, fall back to "10 HP and below" model.
        const maxShieldHp = target.baseStats.shield_strength;

        if (Number.isFinite(maxShieldHp) && maxShieldHp > 0) {
          const pct = target.state.shield_hp / maxShieldHp; // 0..1
          if (pct <= 0.10) {
            const penalty = Math.min(1, (0.10 - pct) * 10); // 10% less effectiveness per 1% below 10%
            eff *= Math.max(0, 1 - penalty);
          }
        } else {
          if (target.state.shield_hp <= 10) {
            const penalty = Math.min(1, (10 - target.state.shield_hp) * 0.10); // 10% per HP below 10
            eff *= Math.max(0, 1 - penalty);
          }
        }

        // Shields absorb up to (toShields * eff), also capped by remaining shield HP
        const absorb = Math.min(target.state.shield_hp, toShields * eff);

        // Reduce shield HP by what they actually absorbed
        target.state.shield_hp -= absorb;

        // Anything not absorbed leaks through to hull
        const unabsorbed = toShields - absorb;
        if (unabsorbed > 0) {
          // Convert back to baseDamage units by undoing the shield multiplier
          const leakBase = unabsorbed / Sm;
          damageToHull += leakBase * Hm;
        }
      }
    }

    // Snap shields to 0 if <1% of max capacity
    if (target.baseStats.shield_strength > 0) {
      const minThreshold = target.baseStats.shield_strength * 0.01;
      if (target.state.shield_hp > 0 && target.state.shield_hp < minThreshold) {
        // Count the tiny leftover as extra shield damage
        target.state.shield_hp = 0;
      }
    }

    let damageToArmor;

    // Armor mitigation (after shields)
    for (const defense of target.state.defenses) {
      if (defense.type === 'Armor' && (defense.hit_points ?? 0) > 0) {
        const absorbed = damageToHull * 0.8;         // Absorb 80% of hull damage (or defense.effectiveness if it was in target.state)
        damageToHull -= absorbed;                    // Negate the absorbed damage from hull damage
        damageToArmor = Math.max(0, absorbed - 25);  // Negate 25 points of damage to armor because armor is strong
        defense.hit_points -= damageToArmor;         // Deal remaining damage to armor
        if (defense.hit_points < 0) {                // If armor is now down and there is more damage to be dealt...
          damageToHull += -defense.hit_points;       // Apply overshoot damage to damageToHull
          damageToArmor -= -defense.hit_points;      // Update how much damage armor actually took for later reference
          defense.hit_points = 0;                    // Set armor hp to 0 (because it was negative)
        }
      }
    }

    // Finally apply to hull
    target.state.hull_hp = Math.max(0, target.state.hull_hp - damageToHull);

    // Update weapon state (usage + cooldown)
    if (weaponState.usage_left !== 99999) {
      weaponState.usage_left = Math.max(0, weaponState.usage_left - 1);
    }
    weaponState.cooldown_left = weaponBase.cooldown_turns;

    // Decrease cooldowns on ALL weapons each turn
    for (const w of attacker.state.weapons) {
      if (w.cooldown_left > 0) w.cooldown_left--;
    }

    const damageToShields = Math.max(0, originalShieldHp - target.state.shield_hp);
    const totalDamage = damageToShields + damageToHull + (damageToArmor ?? 0);

    // Log the action
    game.turn++;
    game.playerTurn = intent.target; // Only works when we're 100% sure attacker & target are not the same and the game is a 1v1 (which should always be the case currently)
    const weapon = await AppService.getWeaponByID(intent.weapon_id);
    const logMessage = `${attacker.baseStats.name} fired ${weapon.name} at ${target.baseStats.name}, dealing ${Number(totalDamage.toFixed(1))} total damage${target.state.hull_hp === 0 ? ` and destroying ${target.baseStats.name}!` : "."}`;
    game.logs.push({
      player: intent.attacker,
      action: intent,
      damage: {
        shields: damageToShields,
        hull: damageToHull,
        armor: damageToArmor ?? 0
      },
      message: logMessage
    });
    if (target.state.hull_hp <= 0) {
      game.winner = intent.attacker;
    }
    console.log(`Turn ${game.turn - 1}: ${logMessage}`);
    console.log(`Turn completed. Next turn: ${game.turn}`);

    // Create a sanitized copy to send to clients (remove any sensitive token info)
    // Shallow clone is fine here because we don't modify nested objects for sanitization,
    // but ensure playerTokens is removed.
    const sanitizedGame = Object.assign({}, game);
    if (sanitizedGame.playerTokens) delete sanitizedGame.playerTokens;

    return sanitizedGame;
  }

  // ======== CPU Turn ======== \\
  static async getAiIntent(gameId, cpuId) {
    // Verify game exists and get it
    const game = await this.getGame(gameId);
    if (!game)
      throw new Error(`Game ${gameId} not found.`);

    // Verify CPU ID is valid
    if (!cpuId.toUpperCase().startsWith("COM"))
      throw new Error(`CPU ID ${cpuId} is not a valid CPU ID and thus should not exist. It should start with 'COM' and is case in-sensitive.`);
    const cpu = game.ships.find(s => s.pilot.toUpperCase() === cpuId.toUpperCase());
    if (!cpu)
      throw new Error(`Ship piloted by ${cpuId} not found.`);

    // Get target (only other ship in game assuming it's 1v1, which currently is always the case)
    const target = game.ships.find(s => s.pilot.toUpperCase() !== cpuId.toUpperCase());
    // Verify target exists (it always should, but it's best to be safe)
    if (!target) {
      if (debugMode) {
        console.warn(
          "An unexpected error occurred. Is game.ships malformed? game.ships:",
          inspect(game.ships, {
            colors: true, // enable ANSI colors
            depth: null  // unlimited nesting
          }));
      }
      throw new Error("Unable to find a target ship. Is the battle object malformed?");
    }

    // Get CPU weapons
    const cpuWeapons = cpu.state.weapons
      .filter(w => w.cooldown_left === 0 && w.usage_left > 0) // Filter out ones depleted or on cooldown
      .map(w => {
        // Attach baseStats for multipliers, damage, etc.
        const baseWeapon = cpu.baseStats.weapons.find(bw => bw.weapon_id === w.weapon_id);
        return { ...w, ...baseWeapon };
      })
      .filter(w => (w.damage * (w.damage_multiplier ?? 1)) > 0); // Filter out ones that don't do anything yet (i.e. Tribble that does 0 damage)

    // Adjust the probability of choosing weapons based on certain factors (raw damage, shield/hull modifiers, target's shields down, etc.)
    const weightedWeapons = cpuWeapons.map(w => weighWeapon(w));

    // Randomly select a weapon to fire
    const chosenWeapon = pickWeightedRandom(weightedWeapons);

    // Build and return intent object
    return {
      attacker: cpuId,
      weapon_id: chosenWeapon.weapon_id,
      target: target.pilot.toUpperCase()
    }

    // ======== Helper Functions ======== \\

    // Helper function to weigh weapons (adjust probabilities)
    function weighWeapon(weapon) {
      let weight = 1;
      const shieldsMul = weapon.shields_multiplier;
      const hullMul    = weapon.hull_multiplier;

      // If shields are up (and not dangerously low), prioritize weapons strong against shields
      if (target.state.shield_hp >= 10) {
        weight *= shieldsMul ?? 1;
      } else { // If shields are down, prioritize weapons strong against hull
        weight *= hullMul ?? 1;
      }

      // Factor in raw damage (scale: 50 dmg = x1, 100 dmg = x2, cap at x5 (250 dmg).)
      const effectiveDamage = weapon.damage * (weapon.damage_multiplier ?? 1);
      weight *= Math.min(effectiveDamage / 50, 5);

      // Save limited weapons that are good against hull for when target shields goes down
      if (
        target.state.shield_hp >= 10 &&    // target shields not down nor dangerously low
        weapon.max_usage <= 5 &&           // weapon has very limited uses
        (hullMul ?? 1) > (shieldsMul ?? 1) // weapon is stronger against hull than shields
      ) {
        weight *= 0.25;
      } else if ( // Somewhat prioritize limited weapons that are good against hull when target shields are down
        target.state.shield_hp < 10 &&     // target shields are down or dangerously low
        weapon.max_usage <= 5 &&           // weapon has very limited uses
        (hullMul ?? 1) > (shieldsMul ?? 1) // weapon is stronger against hull than shields
      ) {
        weight *= 1.125; // Only a small effect because damage should be a larger factor
      }

      // Avoid negative or 0 weight (set minimum weight to 0.01)
      if (weight < 0.01)
        weight = 0.01;

      return { weapon, weight };
    }

    // Helper function to randomly pick weapon based on adjusted probabilities
    function pickWeightedRandom(weightedArray) {
      const totalWeight = weightedArray.reduce((sum, w) => sum + w.weight, 0);
      let r = Math.random() * totalWeight;

      for (const entry of weightedArray) {
        if ((r -= entry.weight) <= 0) {
          return entry.weapon;
        }
      }
      // fallback (shouldn’t happen if weights > 0)
      return weightedArray[0].weapon;
    }
  }
}

module.exports = GameEngine;
