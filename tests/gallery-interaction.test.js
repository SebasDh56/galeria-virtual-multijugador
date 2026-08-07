const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadArtworkComponent() {
  let definition;
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../public/js/components/gallery-builder.js"
    ),
    "utf8"
  );
  vm.runInNewContext(source, {
    window: {},
    AFRAME: {
      registerComponent(name, componentDefinition) {
        if (name === "gallery-artwork") {
          definition = componentDefinition;
        }
      }
    }
  });
  return definition;
}

function createVisualElement() {
  const classes = new Set();
  const attributes = new Map();
  return {
    attributes,
    classes,
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      }
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    removeAttribute(name) {
      attributes.delete(name);
    }
  };
}

test("todas las obras permanecen disponibles para interacción", () => {
  const definition = loadArtworkComponent();
  const component = Object.create(definition);
  component.data = {
    width: 4,
    color: "#8b3f4c",
    videoSrc: "",
    thumbnailSrc: "",
    title: "",
    author: ""
  };
  component.surface = createVisualElement();
  component.titleText = createVisualElement();
  component.authorText = createVisualElement();
  component.playIcon = createVisualElement();
  component.el = createVisualElement();

  component.renderArtwork();
  assert.equal(component.el.attributes.get("visible"), false);
  assert.equal(
    component.surface.classes.has("interactive-artwork"),
    false
  );
  assert.equal(
    component.surface.attributes.has("video-interaction"),
    false
  );

  component.data.videoSrc = "https://example.com/obra.mp4";
  component.renderArtwork();
  assert.equal(component.el.attributes.get("visible"), true);
  assert.equal(
    component.surface.classes.has("interactive-artwork"),
    true
  );
  assert.equal(
    component.surface.attributes.get("video-interaction").videoSrc,
    "https://example.com/obra.mp4"
  );
});

test("la interacción solicita el visor sin crear videos por obra", () => {
  let definition;
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../public/js/components/video-interaction.js"
    ),
    "utf8"
  );
  vm.runInNewContext(source, {
    window: {
      clearTimeout() {},
      setTimeout() { return 1; }
    },
    AFRAME: {
      registerComponent(name, componentDefinition) {
        if (name === "video-interaction") {
          definition = componentDefinition;
        }
      }
    }
  });

  const emittedEvents = [];
  const component = Object.create(definition);
  component.data = {
    video: null,
    videoSrc: "https://example.com/obra.mp4",
    posterSrc: "https://example.com/obra.webp",
    title: "Obra de prueba",
    author: "Artista",
    pauseOthers: true,
    restartOnEnded: true
  };
  component.el = {
    dataset: { artworkId: "front-1" },
    addEventListener() {},
    setAttribute() {},
    emit(name, detail, bubbles) {
      emittedEvents.push({ name, detail, bubbles });
    }
  };

  component.init();
  component.handleClick();

  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0].name, "artwork-viewer-request");
  assert.equal(emittedEvents[0].detail.artworkId, "front-1");
  assert.equal(
    emittedEvents[0].detail.videoSrc,
    "https://example.com/obra.mp4"
  );
  assert.equal(emittedEvents[0].bubbles, true);
});

test("el visor reproduce y libera un único video al cerrar", async () => {
  let definition;
  const bodyClasses = new Set();
  const documentMock = {
    body: {
      classList: {
        add(name) { bodyClasses.add(name); },
        remove(name) { bodyClasses.delete(name); }
      }
    },
    pointerLockElement: null,
    querySelectorAll() { return []; }
  };
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../public/js/components/artwork-viewer.js"
    ),
    "utf8"
  );
  vm.runInNewContext(source, {
    document: documentMock,
    window: {},
    AFRAME: {
      registerComponent(name, componentDefinition) {
        if (name === "artwork-viewer") {
          definition = componentDefinition;
        }
      }
    }
  });

  const emittedEvents = [];
  const attributes = new Map();
  const viewer = {
    hidden: true,
    setAttribute(name, value) {
      attributes.set(name, value);
    }
  };
  const video = {
    id: "artwork-viewer-video",
    hidden: true,
    paused: true,
    poster: "",
    currentTime: 0,
    loadCount: 0,
    pauseCount: 0,
    async play() {
      this.paused = false;
    },
    pause() {
      this.paused = true;
      this.pauseCount += 1;
    },
    load() {
      this.loadCount += 1;
    },
    removeAttribute(name) {
      if (name === "src") delete this.src;
    }
  };
  const image = {
    hidden: true,
    removeAttribute() {}
  };
  const component = Object.create(definition);
  component.viewer = viewer;
  component.video = video;
  component.image = image;
  component.title = {};
  component.author = {};
  component.message = {};
  component.closeButton = { focus() {} };
  component.isOpen = false;
  component.activeArtwork = null;
  component.el = {
    emit(name, detail) {
      emittedEvents.push({ name, detail });
    }
  };
  const artworkEvents = [];
  const artwork = {
    artworkId: "front-01",
    title: "Obra de prueba",
    author: "Artista",
    videoSrc: "https://example.com/obra.mp4",
    posterSrc: "https://example.com/obra.webp",
    pauseOthers: true,
    restartOnEnded: true,
    sourceElement: {
      emit(name, detail) {
        artworkEvents.push({ name, detail });
      }
    }
  };

  component.handleOpen({ detail: artwork });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(viewer.hidden, false);
  assert.equal(attributes.get("aria-hidden"), "false");
  assert.equal(bodyClasses.has("artwork-viewer-open"), true);
  assert.equal(video.src, artwork.videoSrc);
  assert.equal(video.paused, false);
  assert.equal(artworkEvents[0].detail.isPlaying, true);
  assert.equal(emittedEvents[0].name, "artwork-viewer-opened");

  component.handleClose();

  assert.equal(viewer.hidden, true);
  assert.equal(attributes.get("aria-hidden"), "true");
  assert.equal(bodyClasses.has("artwork-viewer-open"), false);
  assert.equal(video.src, undefined);
  assert.equal(video.paused, true);
  assert.equal(emittedEvents[1].name, "artwork-viewer-closed");
});
