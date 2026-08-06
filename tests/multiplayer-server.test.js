const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const WebSocket = require("ws");

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 8000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("El servidor terminó antes de iniciar.");
    }

    const isReady = await new Promise((resolve) => {
      const request = http.get(
        `http://127.0.0.1:${port}/api/health`,
        (response) => {
          response.resume();
          resolve(response.statusCode === 200);
        }
      );
      request.on("error", () => resolve(false));
      request.setTimeout(500, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (isReady) {
      return;
    }

    await delay(80);
  }

  throw new Error("El servidor no inició a tiempo.");
}

class SocketIoTestClient {
  constructor(port) {
    this.events = [];
    this.waiters = [];
    this.connected = new Promise((resolve, reject) => {
      this.resolveConnection = resolve;
      this.rejectConnection = reject;
    });
    this.socket = new WebSocket(
      `ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`
    );
    this.socket.on("message", (data) => this.handleMessage(String(data)));
    this.socket.once("error", (error) => this.rejectConnection(error));
  }

  handleMessage(message) {
    if (message.startsWith("0")) {
      this.socket.send("40");
      return;
    }

    if (message === "2") {
      this.socket.send("3");
      return;
    }

    if (message.startsWith("40")) {
      const connection = JSON.parse(message.slice(2) || "{}");
      this.id = connection.sid;
      this.resolveConnection();
      return;
    }

    if (!message.startsWith("42")) {
      return;
    }

    const [name, payload] = JSON.parse(message.slice(2));
    const event = { name, payload };
    this.events.push(event);
    this.waiters = this.waiters.filter((waiter) => {
      if (waiter.name !== name || !waiter.predicate(payload)) {
        return true;
      }

      clearTimeout(waiter.timeout);
      waiter.resolve(payload);
      return false;
    });
  }

  emit(name, payload) {
    this.socket.send(`42${JSON.stringify([name, payload])}`);
  }

  waitFor(name, predicate = () => true, timeoutMs = 1500) {
    const existing = this.events.find(
      (event) => event.name === name && predicate(event.payload)
    );

    if (existing) {
      return Promise.resolve(existing.payload);
    }

    return new Promise((resolve, reject) => {
      const waiter = { name, predicate, resolve };
      waiter.timeout = setTimeout(() => {
        this.waiters = this.waiters.filter(
          (current) => current !== waiter
        );
        reject(new Error(`No se recibió ${name}.`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  clearEvents() {
    this.events.length = 0;
  }

  close() {
    this.socket.close();
  }
}

async function join(client, nickname, position) {
  await client.connected;
  client.emit("player:join", {
    clientId: `${nickname}-client`,
    nickname,
    avatarType: "male",
    clothingColor: "#c8102e",
    position,
    rotationY: 0
  });
  await client.waitFor("player:spawn");
  return client.waitFor("players:snapshot");
}

async function startTestServer(t) {
  const port = await getFreePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverError = "";
  child.stderr.on("data", (data) => {
    serverError += String(data);
  });
  t.after(() => child.kill());
  await waitForServer(port, child);
  return {
    port,
    getServerError: () => serverError
  };
}

function closeClientsAfterTest(t, clients) {
  t.after(() => clients.forEach((client) => client.close()));
}

test("las zonas aíslan tráfico y conservan visibilidad cercana", async (t) => {
  const { port, getServerError } = await startTestServer(t);

  const lobby = new SocketIoTestClient(port);
  const corridor = new SocketIoTestClient(port);
  const mainRoom = new SocketIoTestClient(port);
  closeClientsAfterTest(t, [lobby, corridor, mainRoom]);

  assert.deepEqual(
    await join(lobby, "Lobby", { x: 0, y: 0.12, z: 18 }),
    []
  );
  assert.deepEqual(
    await join(corridor, "Corridor", { x: 0, y: 0.12, z: 0 }),
    []
  );
  assert.deepEqual(
    await join(mainRoom, "Main", { x: 0, y: 0.12, z: -16 }),
    []
  );

  lobby.clearEvents();
  mainRoom.clearEvents();
  corridor.emit("player:move", {
    position: { x: 0, y: 0.12, z: -7 },
    rotationY: 0,
    speed: 3.2
  });
  const nearbySnapshot = await corridor.waitFor(
    "players:snapshot",
    (players) => players.some((player) => player.nickname === "Main")
  );
  assert.equal(nearbySnapshot.length, 1);
  await delay(180);
  assert.equal(
    lobby.events.some((event) => event.name === "player:moved"),
    false,
    "el lobby lejano no recibe movimientos del pasillo"
  );

  await delay(60);
  corridor.clearEvents();
  mainRoom.clearEvents();
  corridor.emit("player:move", {
    position: { x: 0, y: 0.12, z: -9.2 },
    rotationY: 0,
    speed: 3.2
  });
  const mainSnapshot = await mainRoom.waitFor(
    "players:snapshot",
    (players) =>
      players.some((player) => player.nickname === "Corridor")
  );
  assert.equal(mainSnapshot.length, 1);

  assert.equal(getServerError(), "");
});

test("30 conexiones distribuidas reducen las retransmisiones", async (t) => {
  const { port, getServerError } = await startTestServer(t);
  const positions = [];

  [17, 20].forEach((z) => {
    [-4, -2, 0, 2, 4].forEach((x) => {
      positions.push({ x, y: 0.12, z });
    });
  });
  [-4, -1, 2, 4].forEach((z) => {
    [-2, 0, 2].forEach((x) => {
      if (positions.length < 20) {
        positions.push({ x, y: 0.12, z });
      }
    });
  });
  [-20, -17].forEach((z) => {
    [-8, -4, 0, 4, 8].forEach((x) => {
      positions.push({ x, y: 0.12, z });
    });
  });

  assert.equal(positions.length, 30);
  const clients = positions.map(() => new SocketIoTestClient(port));
  closeClientsAfterTest(t, clients);
  await Promise.all(
    clients.map((client, index) =>
      join(client, `Player${index}`, positions[index])
    )
  );
  clients.forEach((client) => client.clearEvents());

  clients.forEach((client, index) => {
    const position = positions[index];
    client.emit("player:move", {
      position: { ...position, x: position.x + 0.1 },
      rotationY: 0,
      speed: 3.2
    });
  });

  await delay(500);
  const movementDeliveries = clients.reduce(
    (total, client) =>
      total +
      client.events.filter(
        (event) => event.name === "player:moved"
      ).length,
    0
  );

  assert.equal(
    movementDeliveries,
    270,
    "tres grupos de 10 generan 3 × 10 × 9 entregas"
  );
  assert.ok(
    movementDeliveries < 30 * 29,
    "las zonas evitan la difusión global"
  );
  assert.equal(getServerError(), "");
});
