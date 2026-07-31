const path = require("node:path");
const http = require("node:http");

const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;
const DEFAULT_SPAWN = Object.freeze({ x: 0, y: 0.12, z: 16 });
const SPAWN_POSITIONS = [
  { x: 0, y: 0.12, z: 16 },
  { x: -1.8, y: 0.12, z: 16 },
  { x: 1.8, y: 0.12, z: 16 },
  { x: 0, y: 0.12, z: 18 },
  { x: -1.8, y: 0.12, z: 18 },
  { x: 1.8, y: 0.12, z: 18 }
];
const AVATAR_TYPES = new Set(["male", "female"]);
const CLOTHING_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const players = new Map();
const playerSessions = new Map();

function clampNumber(value, minimum, maximum, fallback) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? Math.min(maximum, Math.max(minimum, numericValue))
    : fallback;
}

function sanitizeNickname(value) {
  const nickname = String(value || "")
    .trim()
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .slice(0, 20);

  return nickname || "Visitante";
}

function sanitizeAvatarType(value) {
  return AVATAR_TYPES.has(value) ? value : "male";
}

function sanitizeClothingColor(value) {
  return CLOTHING_COLOR_PATTERN.test(value)
    ? value.toLowerCase()
    : "#c8102e";
}

function sanitizeClientId(value, fallback) {
  const clientId = String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);

  return clientId || fallback;
}

function sanitizePosition(position = {}) {
  return {
    x: clampNumber(position.x, -13.62, 13.62, DEFAULT_SPAWN.x),
    y: clampNumber(position.y, 0.12, 3.5, DEFAULT_SPAWN.y),
    z: clampNumber(position.z, -22.62, 22.62, DEFAULT_SPAWN.z)
  };
}

function isPositionAvailable(position, ignoredPlayerId = null) {
  for (const player of players.values()) {
    if (player.id === ignoredPlayerId) {
      continue;
    }

    const deltaX = player.position.x - position.x;
    const deltaZ = player.position.z - position.z;

    if (deltaX * deltaX + deltaZ * deltaZ < 1.5 * 1.5) {
      return false;
    }
  }

  return true;
}

function resolveSpawnPosition(requestedPosition, playerId) {
  if (isPositionAvailable(requestedPosition, playerId)) {
    return requestedPosition;
  }

  return (
    SPAWN_POSITIONS.find(
      (position) => isPositionAvailable(position, playerId)
    ) ||
    requestedPosition
  );
}

function emitPlayersCount() {
  io.emit("players:count", players.size);
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    application: "Galería Virtual Multijugador",
    connectedPlayers: players.size,
    timestamp: new Date().toISOString()
  });
});

io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on("player:join", (payload = {}) => {
    const clientId = sanitizeClientId(
      payload.clientId,
      socket.id
    );
    const previousSocketId = playerSessions.get(clientId);

    if (
      previousSocketId &&
      previousSocketId !== socket.id &&
      players.delete(previousSocketId)
    ) {
      socket.broadcast.emit("player:left", previousSocketId);
    }

    const requestedPosition = sanitizePosition(payload.position);
    const player = {
      id: socket.id,
      clientId,
      nickname: sanitizeNickname(payload.nickname),
      avatarType: sanitizeAvatarType(payload.avatarType),
      clothingColor: sanitizeClothingColor(payload.clothingColor),
      position: resolveSpawnPosition(
        requestedPosition,
        socket.id
      ),
      rotationY: clampNumber(
        payload.rotationY,
        -Math.PI * 2,
        Math.PI * 2,
        Math.PI
      ),
      speed: 0,
      isSprinting: false,
      isJumping: false
    };

    players.set(socket.id, player);
    playerSessions.set(clientId, socket.id);
    socket.emit("player:spawn", {
      position: player.position,
      rotationY: player.rotationY
    });
    socket.emit(
      "players:snapshot",
      Array.from(players.values()).filter(
        (currentPlayer) => currentPlayer.id !== socket.id
      )
    );
    socket.broadcast.emit("player:joined", player);
    emitPlayersCount();
  });

  socket.on("player:move", (payload = {}) => {
    const player = players.get(socket.id);

    if (!player) {
      return;
    }

    player.position = sanitizePosition(payload.position);
    player.rotationY = clampNumber(
      payload.rotationY,
      -Math.PI * 2,
      Math.PI * 2,
      player.rotationY
    );
    player.speed = clampNumber(payload.speed, 0, 6.2, 0);
    player.isSprinting =
      Boolean(payload.isSprinting) && player.speed > 3.2;
    player.isJumping =
      Boolean(payload.isJumping) &&
      player.position.y > DEFAULT_SPAWN.y;

    socket.broadcast.volatile.emit("player:moved", player);
  });

  socket.on("player:action", (payload = {}) => {
    if (!players.has(socket.id) || payload.action !== "wave") {
      return;
    }

    socket.broadcast.emit("player:action", {
      id: socket.id,
      action: "wave"
    });
  });

  socket.on("disconnect", () => {
    const player = players.get(socket.id);

    if (playerSessions.get(player?.clientId) === socket.id) {
      playerSessions.delete(player.clientId);
    }

    if (players.delete(socket.id)) {
      socket.broadcast.emit("player:left", socket.id);
      emitPlayersCount();
    }

    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("----------------------------------------");
  console.log("Galería Virtual Multijugador");
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
  console.log("----------------------------------------");
});
