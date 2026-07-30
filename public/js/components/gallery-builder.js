AFRAME.registerComponent("gallery-builder", {
  schema: {
    wallHeight: { type: "number", default: 4.5 },
    wallThickness: { type: "number", default: 0.25 }
  },

  init() {
    this.buildGallery();
  },

  createEntity(tag, attributes = {}) {
    const entity = document.createElement(tag);

    Object.entries(attributes).forEach(
      ([name, value]) => {
        entity.setAttribute(name, value);
      }
    );

    this.el.appendChild(entity);

    return entity;
  },

  createWall(position, width, depth, color = "#f0f0ef") {
    return this.createEntity("a-box", {
      position,
      width,
      height: this.data.wallHeight,
      depth,
      color,
      shadow: "cast: true; receive: true"
    });
  },

  createFloor(position, width, depth, color = "#8d8d8d") {
    return this.createEntity("a-box", {
      position,
      width,
      height: 0.12,
      depth,
      color,
      shadow: "receive: true"
    });
  },

  createArtwork(position, rotation, id, width = 2.2) {
    const frame = this.createEntity("a-box", {
      position,
      rotation,
      width,
      height: 1.55,
      depth: 0.12,
      color: "#202024",
      class: "artwork-frame"
    });

    const surface = document.createElement("a-plane");

    surface.setAttribute("position", "0 0 -0.071");
    surface.setAttribute("width", width - 0.18);
    surface.setAttribute("height", 1.37);
    surface.setAttribute("color", "#b76b45");
    surface.setAttribute(
      "class",
      "interactive-artwork"
    );

    surface.dataset.artworkId = id;

    frame.appendChild(surface);

    return frame;
  },

  createText(position, value, width = 10) {
    return this.createEntity("a-text", {
      position,
      value,
      width,
      align: "center",
      color: "#202020",
      side: "double"
    });
  },

  buildGallery() {
    /*
      Coordenadas:

      Lobby inicial:
      x: -5 a 5
      z: 7 a 15

      Pasillo:
      x: -2.5 a 2.5
      z: -7 a 7

      Sala final:
      x: -11 a 11
      z: -17 a -7
    */

    this.createFloor("0 0 11", 10, 8, "#757575");
    this.createFloor("0 0 0", 5, 14, "#858585");
    this.createFloor("0 0 -12", 22, 10, "#707070");

    // Lobby inicial.
    this.createWall("-5 2.25 11", 0.25, 8);
    this.createWall("5 2.25 11", 0.25, 8);
    this.createWall("0 2.25 15", 10, 0.25);

    // Pared frontal del lobby con abertura central.
    this.createWall("-3.75 2.25 7", 2.5, 0.25);
    this.createWall("3.75 2.25 7", 2.5, 0.25);

    // Pasillo.
    this.createWall("-2.5 2.25 0", 0.25, 14);
    this.createWall("2.5 2.25 0", 0.25, 14);

    // Sala rectangular superior tipo T.
    this.createWall("-11 2.25 -12", 0.25, 10);
    this.createWall("11 2.25 -12", 0.25, 10);
    this.createWall("0 2.25 -17", 22, 0.25);

    // Pared inferior de la sala con entrada.
    this.createWall("-6.75 2.25 -7", 8.5, 0.25);
    this.createWall("6.75 2.25 -7", 8.5, 0.25);

    // Logo provisional del lobby.
    this.createEntity("a-circle", {
      position: "0 2.4 14.84",
      rotation: "0 180 0",
      radius: 1.15,
      color: "#d62828"
    });

    this.createText(
      "0 2.4 14.7",
      "UDLA",
      5
    );

    this.createText(
      "0 1.1 14.7",
      "English Art Gallery",
      7
    );

    // Obras del pasillo: dos por lado.
    this.createArtwork(
      "-2.36 2.1 3.5",
      "0 90 0",
      "corridor-left-01"
    );

    this.createArtwork(
      "-2.36 2.1 -2.5",
      "0 90 0",
      "corridor-left-02"
    );

    this.createArtwork(
      "2.36 2.1 3.5",
      "0 -90 0",
      "corridor-right-01"
    );

    this.createArtwork(
      "2.36 2.1 -2.5",
      "0 -90 0",
      "corridor-right-02"
    );

    // Cuatro obras en la pared del fondo.
    const backArtworkX = [-7.5, -2.5, 2.5, 7.5];

    backArtworkX.forEach((x, index) => {
      this.createArtwork(
        `${x} 2.1 -16.84`,
        "0 0 0",
        `back-${index + 1}`,
        3.2
      );
    });

    // Una obra en cada pared lateral.
    this.createArtwork(
      "-10.84 2.1 -12",
      "0 90 0",
      "left-wall-01",
      3
    );

    this.createArtwork(
      "10.84 2.1 -12",
      "0 -90 0",
      "right-wall-01",
      3
    );

    // Dos obras en la pared de retorno.
    this.createArtwork(
      "-6 2.1 -7.16",
      "0 180 0",
      "return-left-01",
      3
    );

    this.createArtwork(
      "6 2.1 -7.16",
      "0 180 0",
      "return-right-01",
      3
    );

    // Iluminación ambiental.
    this.createEntity("a-entity", {
      light:
        "type: ambient; color: #ffffff; intensity: 0.6"
    });

    // Luces de las tres zonas.
    [
      "0 4 11",
      "0 4 2",
      "0 4 -4",
      "-6 4 -12",
      "0 4 -12",
      "6 4 -12"
    ].forEach((position) => {
      this.createEntity("a-entity", {
        position,
        light:
          "type: point; color: #fff7e8; intensity: 0.85; distance: 12; decay: 2"
      });
    });
  }
});