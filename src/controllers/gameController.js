const { pool } = require("../config/database");
const { spawn } = require("child_process");
const debugMode = process.env.DEBUG?.toLowerCase() === 'true';

class GameController {
  static getStatus(req, res) {
    // Spawn Python process
    const python = spawn("python3", ["src/PythonEngine/status.py"]);

    let output = "";

    // Collect Python output
    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      console.error(`Python stderr: ${data.toString()}`);
      // stderr usually means Python runtime errors, respond with 500
      if (!res.headersSent) {
        const response = { status: "Not OK" };
        if (debugMode) response["Python stderr"] = data.toString();
        res.status(500).send(response);
      }
    });

    python.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);

      let json;
      try {
        json = JSON.parse(output);
      } catch (err) {
        console.error("Failed to parse JSON from Python:", err);
        return res.status(500).send({ status: "Not OK", error: "Invalid JSON response from Python" });
      }

      // Log all python logs to Node console
      if (Array.isArray(json.python_logs)) {
        json.python_logs.forEach((log) => console.log("Python log:", log));
      }

      // Use the Python script's 'status' field as the HTTP status code
      const httpStatus = json.status && Number.isInteger(json.status) ? json.status : 500;

      // If there's an error field, treat as an error response
      if (json.error) {
        if (!res.headersSent) {
          const response = { status: "Not OK", message: "An internal Python error has occurred" };
          if (debugMode) {
            response["python_message"] = json.message;
            response["error"] = json.error
          }
          return res.status(httpStatus).send(response);
        }
      }

      // Otherwise, send success or custom message
      if (!res.headersSent) {
        if (json.message === "Hello World!" && json.status === 200) {
          return res.status(200).send({
            status: "OK"
          });
        } else {
          const response = { status: "Not OK", message: "Unexpected Python response" };
          if (debugMode) {
            response["python_output"] = json;
          }
          return res.status(422).send(response)
        }
      }
    });
  }

  static async postNewGame(req, res) {
    if (!req.body) {
      return res.status(400).send("Request body is missing.");
    }
    const { type, ships } = req.body;
    const VALID_TYPES = ["AI V AI", "PLAYER V AI", "PLAYER V PLAYER", "AI V BOSS", "PLAYER V BOSS", "PLAYERS V BOSS" ];
    const IMPLEMENTED_TYPES = ["AI V AI", "PLAYER V AI"];

    const example_req_body = {
      type: "PLAYER V AI",
      ships: [
        {
          ship_id: 1,
          pilot: "p1",
          is_boss: false
        },
        {
          ship_id: 12,
          pilot: "com1",
          is_boss: false
        }
      ]
    };

    // Validate type
    if (!type) { // Check if type param is provided
      return res.status(400).send("Missing body param 'type'");
    }
    if (typeof type !== "string") { // Check if type is a string
      return res.status(400).send("Param 'type' must be a string");
    }
    if (!VALID_TYPES.includes(type.toUpperCase())) { // Check if given type is valid
      return res.status(400).send(`Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (!IMPLEMENTED_TYPES.includes(type.toUpperCase())) { // Check if given type is implemented
      return res.status(501).send(`This type of battle is not implemented yet. Try one of these: ${IMPLEMENTED_TYPES.join(", ")}`);
    }
    // Validate ships
    if (!ships) { // Check if ships param is missing or null
      return res.status(400).send("Missing body param 'ships'");
    }
    if (!Array.isArray(ships)) { // Check if ships param is not an array
      return res.status(400).send("Param 'ships' must be an array");
    }
    if (ships.length < 2) { // Check if there are less than 2 ships in array
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

    if (shipsCheck.error === true) { // Error handling
      return res.status(500).send({ error: shipsCheck.reason });
    }
    if (!shipsCheck.valid) {
      return res.status(400).send(`Param 'ships' is invalid: ${shipsCheck.reason}`);
    }

    return res.status(501).send("Not implemented yet. All validation checks passed.");

    // Todo: Ser up game in database
    // Todo: generate player tokens and player/ai IDs
    // Todo: maybe do some auth checking
    // Todo: maybe generate player auth token
    // Todo: generate a sharable spectate token
    // Todo: return only the data the client needs
    // Note: the client on all players' ends will likely be listening for a
    //       response if more than one player is participating. We will need
    //       to figure that out on both the front end and back end.

    // ---------------------------------------------------------------------- \\

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

    return res.status(200).send({ example_response });
  }

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

  static async postIntent(req, res) {
    res.status(501).send("Not implemented yet.");

    // Todo: receive game action, check player token, and maybe do some auth checking
  }
}

module.exports = GameController;
