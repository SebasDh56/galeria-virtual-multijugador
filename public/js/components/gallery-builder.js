(() => {
  const FLOOR_HEIGHT = 0.12;
  const FRAME_DEPTH = 0.12;
  const DEFAULT_WALL_COLOR = "#f0f0ef";
  const UDLA_RED = "#c8102e";
  const ARTWORK_MEDIA =
    window.GALLERY_ARTWORK_MEDIA || Object.freeze({});

  const FLOOR_SECTIONS = [
    { position: "0 0 16", width: 14, depth: 14, color: "#757575" },
    { position: "0 0 0", width: 7, depth: 18, color: "#858585" },
    { position: "0 0 -16", width: 28, depth: 14, color: "#707070" }
  ];

  const WALL_SECTIONS = [
    { position: "-7 2.625 16", width: 0.25, depth: 14 },
    { position: "7 2.625 16", width: 0.25, depth: 14 },
    { position: "0 2.625 23", width: 14, depth: 0.25 },
    { position: "-5.25 2.625 9", width: 3.5, depth: 0.25 },
    { position: "5.25 2.625 9", width: 3.5, depth: 0.25 },
    { position: "-3.5 2.625 0", width: 0.25, depth: 18 },
    { position: "3.5 2.625 0", width: 0.25, depth: 18 },
    { position: "-14 2.625 -16", width: 0.25, depth: 14 },
    { position: "14 2.625 -16", width: 0.25, depth: 14 },
    { position: "0 2.625 -23", width: 28, depth: 0.25 },
    { position: "-8.75 2.625 -9", width: 10.5, depth: 0.25 },
    { position: "8.75 2.625 -9", width: 10.5, depth: 0.25 }
  ];

  const ARTWORKS = [
    {
      id: "corridor-left-01",
      position: "-3.34 2.55 4.25",
      rotation: "0 90 0",
      width: 2.7,
      height: 1.85,
      color: "#a95d42"
    },
    {
      id: "corridor-left-02",
      position: "-3.34 2.55 -3.25",
      rotation: "0 90 0",
      width: 2.7,
      height: 1.85,
      color: "#4d748c"
    },
    {
      id: "corridor-right-01",
      position: "3.34 2.55 4.25",
      rotation: "0 -90 0",
      width: 2.7,
      height: 1.85,
      color: "#c89a4a"
    },
    {
      id: "corridor-right-02",
      position: "3.34 2.55 -3.25",
      rotation: "0 -90 0",
      width: 2.7,
      height: 1.85,
      color: "#70568e"
    },
    {
      id: "front-01",
      position: "-10.5 2.65 -22.78",
      rotation: "0 0 0",
      width: 4.2,
      height: 2.05,
      color: "#8b3f4c"
    },
    {
      id: "front-02",
      position: "-3.5 2.65 -22.78",
      rotation: "0 0 0",
      width: 4.2,
      height: 2.05,
      color: "#3f7d73"
    },
    {
      id: "front-03",
      position: "3.5 2.65 -22.78",
      rotation: "0 0 0",
      width: 4.2,
      height: 2.05,
      color: "#b16f3b"
    },
    {
      id: "front-04",
      position: "10.5 2.65 -22.78",
      rotation: "0 0 0",
      width: 4.2,
      height: 2.05,
      color: "#536f9f"
    },
    {
      id: "left-wall-01",
      position: "-13.78 2.65 -16",
      rotation: "0 90 0",
      width: 4,
      height: 2,
      color: "#a84f72"
    },
    {
      id: "right-wall-01",
      position: "13.78 2.65 -16",
      rotation: "0 -90 0",
      width: 4,
      height: 2,
      color: "#617e3f"
    },
    {
      id: "interior-left-01",
      position: "-8 2.65 -9.22",
      rotation: "0 180 0",
      width: 4,
      height: 2,
      color: "#9a713d"
    },
    {
      id: "interior-right-01",
      position: "8 2.65 -9.22",
      rotation: "0 180 0",
      width: 4,
      height: 2,
      color: "#486e85"
    }
  ];

  const LIGHT_POSITIONS = [
    "0 4.8 16",
    "0 4.8 5",
    "0 4.8 -4",
    "-8 4.8 -16",
    "0 4.8 -16",
    "8 4.8 -16"
  ];

  const WALKABLE_ZONES = [
    { minX: -6.62, maxX: 6.62, minZ: 9, maxZ: 22.62 },
    { minX: -3.12, maxX: 3.12, minZ: -9, maxZ: 9 },
    { minX: -13.62, maxX: 13.62, minZ: -22.62, maxZ: -9 }
  ];

  AFRAME.registerComponent("gallery-surface", {
    schema: {
      width: { type: "number", default: 1 },
      height: { type: "number", default: 1 },
      depth: { type: "number", default: 1 },
      color: { type: "color", default: DEFAULT_WALL_COLOR },
      castShadow: { type: "boolean", default: true },
      receiveShadow: { type: "boolean", default: true }
    },

    update() {
      this.el.setAttribute("geometry", {
        primitive: "box",
        width: this.data.width,
        height: this.data.height,
        depth: this.data.depth
      });

      this.el.setAttribute("material", {
        color: this.data.color,
        roughness: 0.88,
        metalness: 0
      });

      this.el.setAttribute("shadow", {
        cast: this.data.castShadow,
        receive: this.data.receiveShadow
      });
    }
  });

  AFRAME.registerComponent("gallery-artwork", {
    schema: {
      artworkId: { type: "string" },
      width: { type: "number", default: 2.2 },
      height: { type: "number", default: 1.85 },
      color: { type: "color", default: "#b76b45" },
      videoSrc: { type: "string", default: "" },
      thumbnailSrc: { type: "string", default: "" },
      title: { type: "string", default: "" },
      author: { type: "string", default: "" }
    },

    init() {
      this.frame = document.createElement("a-entity");
      this.surface = document.createElement("a-entity");

      this.frame.setAttribute("geometry", {
        primitive: "box",
        width: this.data.width,
        height: this.data.height,
        depth: FRAME_DEPTH
      });
      this.frame.setAttribute("material", {
        color: "#202024",
        roughness: 0.72
      });
      this.frame.setAttribute("shadow", {
        cast: true,
        receive: true
      });

      this.surface.dataset.artworkId = this.data.artworkId;
      this.surface.dataset.artworkSlotId = this.data.artworkId;
      this.surface.dataset.defaultArtworkColor = this.data.color;
      this.surface.setAttribute(
        "position",
        `0 0 ${FRAME_DEPTH / 2 + 0.006}`
      );
      this.surface.setAttribute("geometry", {
        primitive: "plane",
        width: this.data.width - 0.18,
        height: this.data.height - 0.18
      });
      this.titleText = document.createElement("a-entity");
      this.authorText = document.createElement("a-entity");
      this.playIcon = document.createElement("a-entity");
      this.titleText.setAttribute("position", `0 ${-this.data.height / 2 - 0.24} 0.08`);
      this.authorText.setAttribute("position", `0 ${-this.data.height / 2 - 0.43} 0.08`);
      this.playIcon.setAttribute("geometry", { primitive: "triangle", vertexA: "-0.18 -0.22 0", vertexB: "-0.18 0.22 0", vertexC: "0.23 0 0" });
      this.playIcon.setAttribute("position", "0 0 0.08");
      this.playIcon.setAttribute("material", { color: "#ffffff", shader: "flat", side: "double", opacity: 0.9, transparent: true });

      this.frame.appendChild(this.surface);
      this.frame.append(this.titleText, this.authorText, this.playIcon);
      this.el.appendChild(this.frame);
      this.renderArtwork();
    },

    update() {
      if (this.surface) this.renderArtwork();
    },

    renderArtwork() {
      const hasVideo = Boolean(this.data.videoSrc);
      const hasPoster = Boolean(this.data.thumbnailSrc);
      this.surface.classList.add("interactive-artwork");
      this.surface.setAttribute("material", hasPoster ? {
        src: this.data.thumbnailSrc, color: "#ffffff", shader: "flat", side: "double"
      } : { color: this.data.color, roughness: 0.82, metalness: 0, side: "double" });
      this.surface.setAttribute("video-interaction", {
        videoSrc: this.data.videoSrc,
        posterSrc: this.data.thumbnailSrc,
        title: this.data.title,
        author: this.data.author
      });
      const labelWidth = Math.max(this.data.width * 1.35, 3.4);
      this.titleText.setAttribute("text", { value: this.data.title, align: "center", width: labelWidth, color: "#222222", side: "double" });
      this.authorText.setAttribute("text", { value: this.data.author, align: "center", width: labelWidth, color: "#666666", side: "double" });
      this.titleText.setAttribute("visible", Boolean(this.data.title));
      this.authorText.setAttribute("visible", Boolean(this.data.author));
      this.playIcon.setAttribute("visible", hasVideo);
    },

    remove() {
      this.frame?.remove();
    }
  });

  AFRAME.registerComponent("gallery-builder", {
    schema: {
      wallHeight: { type: "number", default: 5.25 },
      wallThickness: { type: "number", default: 0.25 },
      projectName: {
        type: "string",
        default: "Galería de Arte Virtual"
      },
      spawnPosition: {
        type: "vec3",
        default: { x: 0, y: 0.12, z: 16 }
      }
    },

    init() {
      this.createdEntities = [];
      this.buildGallery();
    },

    createEntity(attributes = {}) {
      const entity = document.createElement("a-entity");

      Object.entries(attributes).forEach(([name, value]) => {
        entity.setAttribute(name, value);
      });

      this.el.appendChild(entity);
      this.createdEntities.push(entity);

      return entity;
    },

    createChild(parent, attributes = {}) {
      const entity = document.createElement("a-entity");

      Object.entries(attributes).forEach(([name, value]) => {
        entity.setAttribute(name, value);
      });

      parent.appendChild(entity);
      return entity;
    },

    createSurface({
      position,
      width,
      height,
      depth,
      color,
      castShadow = true,
      receiveShadow = true
    }) {
      return this.createEntity({
        position,
        "gallery-surface": {
          width,
          height,
          depth,
          color,
          castShadow,
          receiveShadow
        }
      });
    },

    createText(position, value, width, rotation = "0 180 0") {
      return this.createEntity({
        position,
        rotation,
        text: {
          value,
          width,
          align: "center",
          color: "#202020",
          side: "double"
        }
      });
    },

    buildArchitecture() {
      FLOOR_SECTIONS.forEach((section) => {
        this.createSurface({
          ...section,
          height: FLOOR_HEIGHT,
          castShadow: false
        });

        this.createSurface({
          ...section,
          position: section.position.replace(
            " 0 ",
            ` ${this.data.wallHeight + FLOOR_HEIGHT} `
          ),
          height: FLOOR_HEIGHT,
          color: "#d8d8d5",
          castShadow: false
        });
      });

      WALL_SECTIONS.forEach((section) => {
        const positionParts = section.position.split(" ");
        positionParts[1] = String(this.data.wallHeight / 2);

        this.createSurface({
          ...section,
          position: positionParts.join(" "),
          width:
            section.width === 0.25
              ? this.data.wallThickness
              : section.width,
          depth:
            section.depth === 0.25
              ? this.data.wallThickness
              : section.depth,
          height: this.data.wallHeight,
          color: DEFAULT_WALL_COLOR
        });
      });
    },

    buildLobbyIdentity() {
      this.createEntity({
        id: "gallery-spawn-point",
        position: this.data.spawnPosition,
        "data-gallery-role": "spawn"
      });

      this.createEntity({
        position: "0 3.25 22.84",
        rotation: "0 180 0",
        geometry: {
          primitive: "plane",
          width: 5.4,
          height: 1.8
        },
        material: {
          shader: "flat",
          src: "#udla-emblem",
          side: "double"
        }
      });

      this.createText(
        "0 1.72 22.77",
        this.data.projectName,
        9
      );
    },

    buildWalkableZones() {
      WALKABLE_ZONES.forEach((zone) => {
        const entity = this.createEntity({
          class: "gallery-walkable-zone"
        });

        entity.dataset.minX = String(zone.minX);
        entity.dataset.maxX = String(zone.maxX);
        entity.dataset.minZ = String(zone.minZ);
        entity.dataset.maxZ = String(zone.maxZ);
      });
    },

    createPlanter(position, scale = "1 1 1") {
      const planter = this.createEntity({ position, scale });

      this.createChild(planter, {
        position: "0 0.28 0",
        geometry: {
          primitive: "cylinder",
          radius: 0.32,
          height: 0.56,
          segmentsRadial: 12
        },
        material: {
          color: "#8d2536",
          roughness: 0.95
        }
      });

      this.createChild(planter, {
        position: "0 0.83 0",
        geometry: {
          primitive: "cylinder",
          radius: 0.045,
          height: 0.78,
          segmentsRadial: 8
        },
        material: {
          color: "#31533b",
          roughness: 0.9
        }
      });

      [
        {
          position: "-0.16 0.92 0",
          rotation: "0 0 32"
        },
        {
          position: "0.17 1.04 0.04",
          rotation: "0 0 -34"
        },
        {
          position: "0 1.22 -0.03",
          rotation: "0 0 4"
        }
      ].forEach((leaf) => {
        this.createChild(planter, {
          ...leaf,
          geometry: {
            primitive: "sphere",
            radius: 0.23,
            segmentsWidth: 8,
            segmentsHeight: 6
          },
          scale: "0.58 1.25 0.35",
          material: {
            color: "#477553",
            roughness: 0.92
          }
        });
      });
    },

    createBench(position, rotation) {
      const bench = this.createEntity({ position, rotation });
      const woodMaterial = {
        color: "#6d4a36",
        roughness: 0.9
      };

      this.createChild(bench, {
        position: "0 0.52 0",
        geometry: {
          primitive: "box",
          width: 2.2,
          height: 0.16,
          depth: 0.62
        },
        material: woodMaterial
      });

      [-0.82, 0.82].forEach((x) => {
        this.createChild(bench, {
          position: `${x} 0.25 0`,
          geometry: {
            primitive: "box",
            width: 0.16,
            height: 0.5,
            depth: 0.5
          },
          material: {
            color: "#303238",
            roughness: 0.82,
            metalness: 0.1
          }
        });
      });
    },

    buildDecorations() {
      [
        ["-5.65 0.06 20.7", "1 1 1"],
        ["5.65 0.06 20.7", "1 1 1"],
        ["-12.1 0.06 -20.4", "1.1 1.1 1.1"],
        ["12.1 0.06 -20.4", "1.1 1.1 1.1"]
      ].forEach(([position, scale]) => {
        this.createPlanter(position, scale);
      });

      this.createBench("-5.75 0.06 14.8", "0 90 0");
      this.createBench("5.75 0.06 14.8", "0 -90 0");

      [
        "-6.78 0.1 16",
        "6.78 0.1 16"
      ].forEach((position) => {
        this.createSurface({
          position,
          width: 0.08,
          height: 0.06,
          depth: 12,
          color: UDLA_RED,
          castShadow: false,
          receiveShadow: false
        });
      });
    },

    buildArtworks() {
      ARTWORKS.forEach((artwork) => {
        this.createEntity({
          position: artwork.position,
          rotation: artwork.rotation,
          "gallery-artwork": {
            artworkId: artwork.id,
            width: artwork.width || 2.2,
            height: artwork.height || 1.85,
            color: artwork.color,
            videoSrc: ARTWORK_MEDIA[artwork.id] || ""
          }
        });
      });
    },

    buildLighting() {
      this.createEntity({
        light: {
          type: "ambient",
          color: "#fffdf8",
          intensity: 0.76
        }
      });

      this.createEntity({
        light: {
          type: "hemisphere",
          color: "#fff7e8",
          groundColor: "#5d6370",
          intensity: 0.34
        }
      });

      LIGHT_POSITIONS.forEach((position) => {
        const [x, y, z] = position.split(" ").map(Number);

        this.createEntity({
          class: "gallery-point-light",
          position,
          light: {
            type: "point",
            color: "#fff7e8",
            intensity: 1.08,
            distance: 18,
            decay: 2
          }
        });

        this.createEntity({
          position: `${x} ${y + 0.42} ${z}`,
          geometry: {
            primitive: "box",
            width: 2.4,
            height: 0.035,
            depth: 0.45
          },
          material: {
            color: "#fff8df",
            emissive: "#fff1bd",
            emissiveIntensity: 1.15,
            roughness: 0.45
          }
        });
      });
    },

    buildGallery() {
      this.buildArchitecture();
      this.buildWalkableZones();
      this.buildLobbyIdentity();
      this.buildArtworks();
      this.buildDecorations();
      this.buildLighting();

      this.el.sceneEl?.emit(
        "gallery-built",
        { spawnPosition: this.data.spawnPosition },
        true
      );
    },

    remove() {
      this.createdEntities.forEach((entity) => entity.remove());
      this.createdEntities.length = 0;
    }
  });
})();
