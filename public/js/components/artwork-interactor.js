AFRAME.registerComponent("artwork-interactor", {
  schema: {
    maxDistance: { type: "number", default: 11 },
    selectionAngle: { type: "number", default: 32 }
  },

  init() {
    this.firstPersonCamera =
      this.el.querySelector("#first-person-camera");
    this.thirdPersonCamera =
      this.el.querySelector("#third-person-camera");
    this.artworks = [];

    this.cameraPosition = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    this.artworkPosition = new THREE.Vector3();
    this.directionToArtwork = new THREE.Vector3();

    this.minimumAlignment = Math.cos(
      THREE.MathUtils.degToRad(this.data.selectionAngle)
    );
    this.lastArtworkInteractionTime = -Infinity;

    this.cacheArtworks = this.cacheArtworks.bind(this);
    this.handleWindowClick =
      this.handleWindowClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleInteractionRequest =
      this.handleInteractionRequest.bind(this);
    this.recordArtworkInteraction =
      this.recordArtworkInteraction.bind(this);

    this.cacheArtworks();

    this.el.sceneEl.addEventListener(
      "gallery-built",
      this.cacheArtworks
    );
    this.el.sceneEl.addEventListener(
      "artworks-updated",
      this.cacheArtworks
    );
    this.el.sceneEl.addEventListener(
      "artwork-interaction",
      this.recordArtworkInteraction
    );
    this.el.addEventListener(
      "interact-artwork",
      this.handleInteractionRequest
    );
    window.addEventListener("click", this.handleWindowClick);
    window.addEventListener("keydown", this.handleKeyDown);
  },

  update(previousData) {
    if (
      previousData.selectionAngle !==
      this.data.selectionAngle
    ) {
      this.minimumAlignment = Math.cos(
        THREE.MathUtils.degToRad(
          this.data.selectionAngle
        )
      );
    }
  },

  cacheArtworks() {
    this.artworks = Array.from(
      document.querySelectorAll(".interactive-artwork")
    );
  },

  getActiveCamera() {
    const firstCamera = this.firstPersonCamera?.components.camera;

    return firstCamera?.data.active
      ? this.firstPersonCamera
      : this.thirdPersonCamera;
  },

  getBestArtwork() {
    const cameraEntity = this.getActiveCamera();
    const camera =
      cameraEntity?.getObject3D("camera") ||
      cameraEntity?.object3D;

    if (!camera) {
      return null;
    }

    camera.getWorldPosition(this.cameraPosition);
    camera.getWorldDirection(this.cameraDirection);

    const maximumDistanceSquared =
      this.data.maxDistance * this.data.maxDistance;
    let selectedArtwork = null;
    let bestScore = -Infinity;

    for (let index = 0; index < this.artworks.length; index += 1) {
      const artwork = this.artworks[index];

      if (!artwork.isConnected || !artwork.object3D.visible) {
        continue;
      }

      artwork.object3D.getWorldPosition(this.artworkPosition);
      this.directionToArtwork
        .subVectors(
          this.artworkPosition,
          this.cameraPosition
        );

      const distanceSquared =
        this.directionToArtwork.lengthSq();

      if (
        distanceSquared === 0 ||
        distanceSquared > maximumDistanceSquared
      ) {
        continue;
      }

      const distance = Math.sqrt(distanceSquared);
      this.directionToArtwork.multiplyScalar(1 / distance);

      const alignment = this.cameraDirection.dot(
        this.directionToArtwork
      );

      if (alignment < this.minimumAlignment) {
        continue;
      }

      const score =
        alignment -
        (distance / this.data.maxDistance) * 0.16;

      if (score > bestScore) {
        bestScore = score;
        selectedArtwork = artwork;
      }
    }

    return selectedArtwork;
  },

  interact() {
    this.getBestArtwork()?.emit("click");
  },

  isEditableTarget(element) {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element?.isContentEditable
    );
  },

  isInterfaceTarget(element) {
    return Boolean(
      element instanceof Element &&
      element.closest(
        "button, input, .mobile-controls, .controls-help, .artwork-viewer"
      )
    );
  },

  handleWindowClick(event) {
    if (
      event.button !== 0 ||
      document.body.classList.contains("artwork-viewer-open") ||
      document.body.classList.contains("touch-interface") ||
      this.isInterfaceTarget(event.target) ||
      performance.now() - this.lastArtworkInteractionTime < 100
    ) {
      return;
    }

    this.interact();
  },

  handleKeyDown(event) {
    if (
      event.code !== "KeyE" ||
      event.repeat ||
      document.body.classList.contains("artwork-viewer-open") ||
      this.isEditableTarget(event.target)
    ) {
      return;
    }

    this.interact();
  },

  handleInteractionRequest() {
    if (document.body.classList.contains("artwork-viewer-open")) {
      return;
    }

    this.interact();
  },

  recordArtworkInteraction() {
    this.lastArtworkInteractionTime = performance.now();
  },

  remove() {
    this.el.sceneEl.removeEventListener(
      "gallery-built",
      this.cacheArtworks
    );
    this.el.sceneEl.removeEventListener(
      "artworks-updated",
      this.cacheArtworks
    );
    this.el.sceneEl.removeEventListener(
      "artwork-interaction",
      this.recordArtworkInteraction
    );
    this.el.removeEventListener(
      "interact-artwork",
      this.handleInteractionRequest
    );
    window.removeEventListener(
      "click",
      this.handleWindowClick
    );
    window.removeEventListener("keydown", this.handleKeyDown);
  }
});
