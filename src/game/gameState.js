// Store active games in memory for now
const activeGames = {};
let io;

function setIO(socketServer) {
  io = socketServer;
}

function getIO() {
  if (!io) throw new Error("Socket.IO server not initialized");
  return io;
}

module.exports = { activeGames, setIO, getIO };
