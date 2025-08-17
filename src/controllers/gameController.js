const { pool } = require("../config/database");
const http = require('http');
const { Server } = require("socket.io");
const {v4: uuidv4 } = require('uuid');
const { activeGames, getIO } = require('../gameState');

// const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

class GameController {
  // GET /engine/status
  static getStatus(req, res) {
    return res.status(200).send(`OK`);
  }

  // POST /engine/game/new
  static async postNewGame(req, res) {
    if (!req.body) {
      return res.status(400).send("Request body is missing.");
    }
    const { type, ships } = req.body;
    const VALID_TYPES = ["AI V AI", "PLAYER V AI", "PLAYER V PLAYER", "AI V BOSS", "PLAYER V BOSS", "PLAYERS V BOSS" ];
    const IMPLEMENTED_TYPES = ["AI V AI", "PLAYER V AI"]; // not actually implemented yet. These 2 are only here for testing validation

    // Example request body to give you ani idea of the format we're trying to parse
    const example_req_body = {
      type: "PLAYER V AI",
      ships: [
        {
          ship_id: 1, // ID linked to a specific ship in the db (i.e. id 0 = USS Enterprise-D, or if is_boss is true, Borg Tactical Cube)
          pilot: "p1", // who this ship belongs to - player or ai, and which player or ai. Case-insensitive
          is_boss: false // if this is a boss ship
        },
        {
          ship_id: 12,
          pilot: "com1",
          is_boss: false
        }
      ]
    };

    // -------------- Validate type -------------- \\
    // Check if type param is provided
    if (!type) {
      return res.status(400).send("Missing body param 'type'");
    }
    // Check if type is a string
    if (typeof type !== "string") {
      return res.status(400).send("Param 'type' must be a string");
    }
    // Check if given game type is valid
    if (!VALID_TYPES.includes(type.toUpperCase())) {
      return res.status(400).send(`Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`);
    }
    // Check if given type is implemented
    if (!IMPLEMENTED_TYPES.includes(type.toUpperCase())) {
      return res.status(501).send(`This type of battle is not implemented yet. Try one of these: ${IMPLEMENTED_TYPES.join(", ")}`);
    }

    // -------------- Validate ships -------------- \\
    // Check if ships param is missing or null
    if (!ships) {
      return res.status(400).send("Missing body param 'ships'");
    }
    // Check if ships param is not an array
    if (!Array.isArray(ships)) {
      return res.status(400).send("Param 'ships' must be an array");
    }
    // Check if there are less than 2 ships in array
    if (ships.length < 2) {
      return res.status(400).send("Param 'ships' must contain at least 2 ships");
    }

    function validateShips(ships) {
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

    // Validate every ship
    const shipsCheck = validateShips(ships);

    // Error handling
    if (shipsCheck.error === true) {
      return res.status(500).send({ error: shipsCheck.reason });
    }
    // Validation check
    if (!shipsCheck.valid) {
      return res.status(400).send(`Param 'ships' is invalid: ${shipsCheck.reason}`);
    }

    const gameId = uuidv4();
    // use gameId as spectate token
    const playerTokens = ships
      .filter(s => !s.is_boss)
      .reduce((acc, s, i) => {
        acc[`P${i+1}`] = uuidv4();
        return acc;
      }, {});

    // Create initial game state
    const gameState = {
      gameId,
      type,
      ships,
      logs: [`Game created: ${type}`],
      turn: 0,
      playerTokens
    };

     // Store in activeGames (for WebSocket broadcasting)
    activeGames[gameId] = gameState;
    getIO().to(`game-${gameId}`).emit('gameUpdate', gameState);

    // Respond with game ID & tokens
    res.status(200).json({ gameId, playerTokens}); // note: maybe filter player tokens so players can only see their token and not the other player's token.

    // ---------------------------------------------------------------------- \\

    // Todo: Set up game in database (?)

    // Example response to get an idea of what the game engine api MIGHT return to the client when finished
    const example_response = {
      players: {
        P1: {
          id: "some unique ID",
          token: "some token, or null if the requester is not player 1"
        }
      },
      ai: {
        COM1: "some other unique uuid"
      },
      game_id: "some unique ID",
      spectate_token: "some unique token"
    };

  }

  // GET /engine/games/:id
  static async getGame(req, res) {
    if (!req.params.id) {
      return res.status(400).send("Param 'id' is missing. Use /engine/games/:id");
    }
    const game_id = req.query.id;
    return res.status(501).send("Not implemented yet.");

    // Todo: validate game ID by checking database for it
    // Todo: maybe do some auth checking
    // Todo: return only the game data required; avoid returning sensitive data like player tokens
  }

  // GET /engine/games/:id/events
  static async getEvents(req, res) {
    if (!req.params.id) { // This should never happen, but just to be safe...
      return res.status(400).send("Param 'id' is missing. Use /engine/games/:id/events");
    }
    if (!req.query.from_turn) {
      return res.status(400).send("Query param 'from_turn' is required");
    }
    const game_id = req.query.id;
    const turn = parseInt(req.query.from_turn);

    if (isNaN(turn) || turn < 0) {
      return res.status(400).send("Query param 'from_turn' must be a positive number.");
    }

    return res.status(501).send("Not implemented yet.");

    // Todo: Check if game ID is valid by checking database
    // Todo: Check is turn number is valid by checking database for it
    // Todo: maybe do some auth checking
    // Todo: return turn events from the given turn
  }

  // POST /engine/games/:id/intent
  static async postIntent(req, res) {
    res.status(501).send("Not implemented yet.");

    // Todo: receive game action, check player token, and maybe do some auth checking
  }
}

module.exports = GameController;
