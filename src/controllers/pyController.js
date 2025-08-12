;const { spawn } = require("child_process");

class PyController {
  static getStatus(req, res) {
    res.status(200).send({ status: "OK" });
  }

  static greeting(req, res) {
    const name = req.query.name || "World";

    // Spawn Python process
    const python = spawn("python3", ["src/python/hello.py", name]);

    let output = "";

    // Collect Python output
    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      console.error(`Python error: ${data}`);
    });

    python.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);
      res.send(output);
    });
  }
}

module.exports = PyController;
