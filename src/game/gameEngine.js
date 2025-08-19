const {v4: uuidv4 } = require('uuid');
const { activeGames, getIO } = require('./gameState');
const { inspect } = require("node:util");
const AppService = require('../controllers/appService');

const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

class GameEngine {
  static VALID_TYPES = ["AI V AI", "PLAYER V AI", "PLAYER V PLAYER", "AI V BOSS", "PLAYER V BOSS", "PLAYERS V BOSS"];
  static IMPLEMENTED_TYPES = ["PLAYER V AI"];

  // ======== Create new game ======== \\
  static async createGame(setup) {
    const { type, ships } = setup;

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

    // ---------- Build runtime ships ---------- //
    const runtimeShips = [];
    for (const s of ships) {
      const runtimeShip = await this.createRuntimeShip(s.ship_id, s.pilot, s.is_boss);
      runtimeShips.push(runtimeShip);
    }
    // ---------- Create game ---------- //
    const gameId = uuidv4();
    const playerTokens = ships // todo: change this to client side logic so each player can only see their own token without te server needing to manage multiple sockets per game.
      .filter(s => !s.is_boss && s.pilot.toUpperCase().at(0) === "P")
      .reduce((acc, s, i) => {
        acc[`P${i + 1}`] = uuidv4();
        return acc;
      }, {});

    const gameState = {
      gameId,
      type,
      ships: runtimeShips,
      logs: [`Game created: ${type}`],
      turn: 1,
      winner: null,
      playerTokens // todo: remove this when client-side logic generates their player tokens; replace with saving the player token instead.
    };

    // Save game in activeGames (retrieve with await GameEngine.getGame(gameId);)
    activeGames[gameId] = gameState;

    // Broadcast initial game state
    getIO().to(`game-${gameId}`).emit('gameUpdate', gameState);

    return { success: true, gameId, playerTokens, gameState };
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

  // ======== Get game from ID ======== \\
  static getGame(gameId) {
    return activeGames[gameId];
    // Caller is responsible for checking if a game was found with `if (!game) {}`
  }

  // ======== Get game event logs ======== \\
  static async getEvents(gameId, turn=0) {
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
  static async processTurnIntent(game, intent) {
    if (!game) throw new Error("Game object is required");

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
    const baseDamage = weaponBase.damage * parseFloat(weaponBase.damage_multiplier);
    const Sm = parseFloat(weaponBase.shields_multiplier ?? 1);
    const Hm = parseFloat(weaponBase.hull_multiplier ?? 1);
    const bypass = weaponBase.special_effects === 'Partial Shield Bypass' ? 0.6 : 0; // 0..1

    // Portion that goes toward shields, portion that bypasses directly
    const originalShieldHp = target.state.shield_hp;
    let toShields = baseDamage * Sm * (1 - bypass);
    let damageToHull = baseDamage * Sm * bypass; // bypass hull damage

    for (const defense of target.baseStats.defenses) {
      if (defense.type === 'Shield') {
        const shieldEff = parseFloat(defense.effectiveness ?? 1);
        const absorb = Math.min(target.state.shield_hp, toShields * shieldEff);

        target.state.shield_hp -= absorb;
        const unabsorbed = toShields - absorb;

        // any part that shields couldn't handle bleeds into hull
        damageToHull += unabsorbed;
      }
    }

    // If shields are *down*, add the hull-multiplier portion
    if (target.state.shield_hp <= 0) {
      const remainderOfD = Math.max(0, baseDamage - (baseDamage * Sm));
      damageToHull += remainderOfD * Hm;
    }

    // Armor mitigation (after shields)
    for (const defense of target.baseStats.defenses) {
      if (defense.type === 'Armor' && (defense.hit_points ?? 0) > 0) {
        const absorbed = damageToHull * 0.8; // or defense.effectiveness
        damageToHull -= absorbed;
        defense.hit_points = Math.max(0, defense.hit_points - absorbed / 3);
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
    const totalDamage = damageToShields + damageToHull;

    // Log the action
    game.turn ++;
    const weapon = await AppService.getWeaponByID(intent.weapon_id);
    game.logs.push({ player: intent.attacker, action: intent, message: `${attacker.baseStats.name} fired ${weapon.name} at ${target.baseStats.name}, dealing ${Number(totalDamage.toFixed(3))} total damage${target.state.hull_hp === 0 ? ` and destroying ${target.baseStats.name}!` : "."}` });
    if (target.state.hull_hp <= 0) {
      game.winner = intent.attacker;
    }
    console.log(`Turn completed. Next turn: ${game.turn}`);

    return game;
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
