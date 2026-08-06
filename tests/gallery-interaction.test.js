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
      }
    },
    setAttribute(name, value) {
      attributes.set(name, value);
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

  component.renderArtwork();
  assert.equal(
    component.surface.classes.has("interactive-artwork"),
    true
  );
  assert.equal(
    component.surface.attributes.get("video-interaction").videoSrc,
    ""
  );

  component.data.videoSrc = "https://example.com/obra.mp4";
  component.renderArtwork();
  assert.equal(
    component.surface.attributes.get("video-interaction").videoSrc,
    "https://example.com/obra.mp4"
  );
});
