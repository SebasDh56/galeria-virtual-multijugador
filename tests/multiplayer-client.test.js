const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(vector) {
    return this.set(vector.x, vector.y, vector.z);
  }

  distanceToSquared(vector) {
    return (
      (this.x - vector.x) ** 2 +
      (this.y - vector.y) ** 2 +
      (this.z - vector.z) ** 2
    );
  }
}

function loadComponent() {
  let definition;
  let now = 100;
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../public/js/components/multiplayer-manager.js"
    ),
    "utf8"
  );
  const context = {
    AFRAME: {
      registerComponent(name, componentDefinition) {
        if (name === "multiplayer-manager") {
          definition = componentDefinition;
        }
      }
    },
    THREE: {
      Vector3,
      MathUtils: {
        degToRad: (degrees) => degrees * Math.PI / 180
      }
    },
    document: { querySelector: () => null },
    performance: { now: () => now }
  };

  vm.runInNewContext(source, context);
  return {
    definition,
    setNow(value) {
      now = value;
    }
  };
}

function createManager(definition) {
  const emitted = [];
  const manager = Object.create(definition);
  manager.data = {
    localRig: {
      object3D: { position: new Vector3(0, 0.12, 16) }
    },
    localAvatar: {
      object3D: { rotation: { y: 0 } }
    },
    sendRate: 10,
    idleSendRate: 0.5,
    positionThreshold: 0.025,
    rotationThreshold: 1.5,
    nearLodDistance: 11,
    farLodDistance: 20,
    cullDistance: 24,
    lodInterval: 250
  };
  manager.init();
  manager.socket = {
    connected: true,
    volatile: {
      emit(name, payload) {
        emitted.push({ name, payload });
      }
    }
  };
  return { emitted, manager };
}

test("reduce mensajes quietos y conserva cambios importantes", () => {
  const { definition, setNow } = loadComponent();
  const { emitted, manager } = createManager(definition);
  const stopped = {
    detail: {
      speed: 0,
      isSprinting: false,
      isJumping: false
    }
  };

  manager.handleLocalMotion(stopped);
  assert.equal(emitted.length, 1, "envía el estado inicial");

  setNow(500);
  manager.handleLocalMotion(stopped);
  assert.equal(emitted.length, 1, "no repite estados quietos");

  setNow(2200);
  manager.handleLocalMotion(stopped);
  assert.equal(emitted.length, 2, "mantiene un latido cada 2 segundos");

  setNow(2250);
  manager.handleLocalMotion({
    detail: {
      speed: 3.2,
      isSprinting: false,
      isJumping: false
    }
  });
  assert.equal(emitted.length, 3, "envía inmediatamente al comenzar");

  manager.data.localRig.object3D.position.z -= 0.01;
  setNow(2350);
  manager.handleLocalMotion({
    detail: {
      speed: 3.2,
      isSprinting: false,
      isJumping: false
    }
  });
  assert.equal(emitted.length, 3, "ignora desplazamientos insignificantes");

  manager.data.localRig.object3D.position.z -= 0.03;
  setNow(2450);
  manager.handleLocalMotion({
    detail: {
      speed: 3.2,
      isSprinting: false,
      isJumping: false
    }
  });
  assert.equal(emitted.length, 4, "envía movimiento significativo");
});

test("mantiene calidad completa cerca y reduce trabajo lejos", () => {
  const { definition } = loadComponent();
  const { manager } = createManager(definition);
  const attributes = [];
  const shadowElement = {
    setAttribute(name, value) {
      attributes.push({ name, value });
    }
  };
  const player = {
    lodLevel: "",
    el: {
      object3D: { visible: true },
      setAttribute(name, property, value) {
        attributes.push({ name, property, value });
      }
    },
    nameLabel: {
      setAttribute(name, value) {
        attributes.push({ name, value });
      }
    },
    shadowParts: [
      {
        element: shadowElement,
        shadow: { cast: true, receive: true }
      }
    ]
  };

  manager.setRemoteLod(player, "near");
  assert.equal(player.el.object3D.visible, true);
  assert.equal(attributes.at(-1).value.cast, true);
  assert.equal(attributes.at(-1).value.receive, true);

  manager.setRemoteLod(player, "far");
  assert.equal(player.el.object3D.visible, true);
  assert.equal(attributes.at(-1).value.cast, false);
  assert.equal(attributes.at(-1).value.receive, false);

  manager.setRemoteLod(player, "hidden");
  assert.equal(player.el.object3D.visible, false);
});

test("reconcilia avatares visibles sin alterar el contador global", () => {
  const { definition } = loadComponent();
  const { manager } = createManager(definition);
  let removedPlayer = "";
  const retainedPlayer = { el: { remove: () => {} } };
  const departingPlayer = {
    el: { remove: () => { removedPlayer = "departing"; } }
  };
  manager.onlineCount = { textContent: "30" };
  manager.remotePlayers = new Map([
    ["retained", retainedPlayer],
    ["departing", departingPlayer]
  ]);
  const upserted = [];
  manager.upsertPlayer = (player) => {
    upserted.push(player.id);
    if (!manager.remotePlayers.has(player.id)) {
      manager.remotePlayers.set(player.id, {
        el: { remove: () => {} }
      });
    }
  };

  manager.handleSnapshot([
    { id: "retained" },
    { id: "arriving" }
  ]);

  assert.deepEqual(upserted, ["retained", "arriving"]);
  assert.equal(removedPlayer, "departing");
  assert.equal(manager.remotePlayers.has("retained"), true);
  assert.equal(manager.remotePlayers.has("arriving"), true);
  assert.equal(manager.remotePlayers.has("departing"), false);
  assert.equal(manager.onlineCount.textContent, "30");
});
