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
}

module.exports = GameController;
