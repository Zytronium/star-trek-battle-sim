class AppController {
  static getStatus(req, res) {
    res.status(200).send({ status: "OK" });
  }
}

module.exports = AppController;
