const { pool } = require("../config/database");
const {v4: uuidv4 } = require('uuid');
const { activeGames, getIO } = require('./gameState');

// const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

class GameEngine {
  static VALID_TYPES = ["AI V AI", "PLAYER V AI", "PLAYER V PLAYER", "AI V BOSS", "PLAYER V BOSS", "PLAYERS V BOSS"];
  static IMPLEMENTED_TYPES = ["PLAYER V AI"];

  // ======== Create new game ======== \\
  static createGame(setup) {
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
      ships,
      logs: [`Game created: ${type}`],
      turn: 0,
      playerTokens // todo: remove this when client-side logic generates their player tokens; replace with saving the player token instead.
    };

    activeGames[gameId] = gameState;

    // Broadcast initial game state
    getIO().to(`game-${gameId}`).emit('gameUpdate', gameState);

    return { success: true, gameId, playerTokens, gameState };
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
    const game = activeGames[gameId];
    if (!game) {
      throw new Error(`Game ${gameId} not found.`);
    }

    return game;
  }

  // ======== Get game event logs ======== \\
  static async getEvents(gameId, turn) {
    if (isNaN(turn) || turn < 0) {
      throw new Error("turn must be a positive number.");
    }

    const game = this.getGame(gameId);

    return game.logs[turn];

    // Todo: Check if game ID is valid by checking database
    // Todo: Check is turn number is valid by checking database for it
    // Todo: maybe do some auth checking
    // Todo: return turn events from the given turn
  }

  // ======== Process game logic for new turn ======== \\
  static processTurnIntent(game, intent) {
    if (!game)
      throw new Error("Game object is required");

    console.log(game);
    console.log("Attacker ship:", intent.attacker);
    console.log("Target ship:", intent.target);

    const attackerShip = game.ships.find(s => s.pilot.toUpperCase() === intent.attacker.toUpperCase());
    const targetShip = game.ships.find(s => s.pilot.toUpperCase() === intent.target.toUpperCase());

    console.log("attacker ship weapons:", attackerShip.weapons);

    if (!attackerShip)
      throw new Error("Invalid attacker ship.");
    if (!targetShip)
      throw new Error("Invalid target ship.");

    const weaponData = attackerShip.weapons.find(w => w.weapon_id === intent.weapon_id);
    if (!weaponData)
      throw new Error("Weapon not equipped on ship");

    // ================ Damage calculations ================ \\
    let baseDamage = weaponData.damage * parseFloat(weaponData.damage_multiplier);
    let damageToShields = baseDamage * parseFloat(weaponData.shields_multiplier);
    let damageToHull = baseDamage * parseFloat(weaponData.hull_multiplier);

    // Apply defenses
    for (const defense of targetShip.defenses) {
      if (defense.type === 'Armor') { // ablative armor
        const absorbed = damageToHull * 0.8;
        damageToHull -= absorbed;
        defense.hit_points -= absorbed / 3;
        if (defense.hit_points < 0) defense.hit_points = 0;
      }

      if (defense.type === 'Shield') {
        const shieldEffectiveness = parseFloat(defense.effectiveness);
        const shieldDamage = damageToShields * shieldEffectiveness;
        const overflowToHull = damageToShields - shieldDamage;

        damageToShields = shieldDamage;
        damageToHull += overflowToHull;
      }
    }

    // Apply damage to shields first, then hull overflow
    targetShip.shield_strength -= damageToShields;
    if (targetShip.shield_strength < 0) {
      damageToHull += -targetShip.shield_strength;
      targetShip.shield_strength = 0;
    }

    targetShip.hull_strength -= damageToHull;
    if (targetShip.hull_strength < 0) targetShip.hull_strength = 0;

    // Reduce weapon max usage
    if (weaponData.max_usage !== 99999) {
      weaponData.max_usage = Math.max(0, weaponData.max_usage - 1);
    }

    // Log the action
    game.logs.push({ player: intent.attacker, action: intent });

    return game;
  }
}

module.exports = GameEngine;
