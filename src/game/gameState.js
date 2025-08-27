// Store active games in memory for now
const activeGames = {};
const waitingRooms = {};
let io;

function setIO(socketServer) {
  io = socketServer;
}

function getIO() {
  if (!io) throw new Error("Socket.IO server not initialized");
  return io;
}

module.exports = { activeGames, waitingRooms, setIO, getIO };
