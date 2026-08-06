const path = require("node:path");
const http = require("node:http");

const express = require("express");
const { Server } = require("socket.io");
const { createAdminRouter } = require("./server/admin-routes");
const {
  loadLocalEnvironment
} = require("./server/environment");
const {
  getInterestRoom,
  haveSameZones,
  resolveGalleryZone,
  resolveInterestZones
} = require("./server/multiplayer-zones");

loadLocalEnvironment(__dirname);

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
const publicDirectory = path.join(__dirname, "public");
const viewsDirectory = path.join(__dirname, "views");
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
const MINIMUM_MOVE_INTERVAL_MS = 50;

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

function serializePlayer(player) {
  return {
    id: player.id,
    clientId: player.clientId,
    nickname: player.nickname,
    avatarType: player.avatarType,
    clothingColor: player.clothingColor,
    position: player.position,
    rotationY: player.rotationY,
    speed: player.speed,
    isSprinting: player.isSprinting,
    isJumping: player.isJumping,
    zone: player.zone
  };
}

function updateInterestRooms(socket, position) {
  const previousZones = socket.data.interestZones || new Set();
  const nextZones = resolveInterestZones(position);

  if (haveSameZones(previousZones, nextZones)) {
    return false;
  }

  previousZones.forEach((zone) => {
    if (!nextZones.has(zone)) {
      socket.leave(getInterestRoom(zone));
    }
  });

  nextZones.forEach((zone) => {
    if (!previousZones.has(zone)) {
      socket.join(getInterestRoom(zone));
    }
  });

  socket.data.interestZones = nextZones;
  return true;
}

function emitVisibleSnapshot(socket, viewer) {
  const visibleZones =
    socket.data.interestZones || resolveInterestZones(viewer.position);
  const visiblePlayers = [];

  players.forEach((player) => {
    if (
      player.id !== viewer.id &&
      visibleZones.has(player.zone)
    ) {
      visiblePlayers.push(serializePlayer(player));
    }
  });

  socket.emit("players:snapshot", visiblePlayers);
}

function refreshVisibilitySnapshots() {
  players.forEach((player, playerId) => {
    const playerSocket = io.sockets.sockets.get(playerId);

    if (playerSocket) {
      emitVisibleSnapshot(playerSocket, player);
    }
  });
}

app.use(express.json({ limit: "16kb" }));
app.use(createAdminRouter({ viewsDirectory }));

app.use(express.static(publicDirectory));

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
      previousSocketId !== socket.id
    ) {
      io.sockets.sockets.get(previousSocketId)?.disconnect(true);
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
      isJumping: false,
      zone: resolveGalleryZone(requestedPosition),
      lastMoveAt: 0
    };

    players.set(socket.id, player);
    playerSessions.set(clientId, socket.id);
    updateInterestRooms(socket, player.position);
    socket.emit("player:spawn", {
      position: player.position,
      rotationY: player.rotationY
    });
    emitVisibleSnapshot(socket, player);
    socket
      .to(getInterestRoom(player.zone))
      .emit("player:joined", serializePlayer(player));
    emitPlayersCount();
  });

  socket.on("player:move", (payload = {}) => {
    const player = players.get(socket.id);

    if (!player) {
      return;
    }

    const now = Date.now();

    if (now - player.lastMoveAt < MINIMUM_MOVE_INTERVAL_MS) {
      return;
    }

    player.lastMoveAt = now;
    const previousZone = player.zone;

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
    player.zone = resolveGalleryZone(player.position);

    const interestsChanged = updateInterestRooms(
      socket,
      player.position
    );

    socket
      .to(getInterestRoom(player.zone))
      .volatile.emit("player:moved", serializePlayer(player));

    if (player.zone !== previousZone) {
      refreshVisibilitySnapshots();
    } else if (interestsChanged) {
      emitVisibleSnapshot(socket, player);
    }
  });

  socket.on("player:action", (payload = {}) => {
    if (!players.has(socket.id) || payload.action !== "wave") {
      return;
    }

    socket.to(getInterestRoom(player.zone)).emit("player:action", {
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
