AFRAME.registerComponent("view-switcher", {
  schema: {
    defaultView: {
      type: "string",
      default: "first"
    }
  },

  init() {
    this.cacheElements();
    this.viewLabel =
      document.querySelector("#current-view-label");
    this.scene = this.el.sceneEl;
    this.currentView = this.normalizeView(this.data.defaultView);

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.toggleView = this.toggleView.bind(this);
    this.handleSceneLoaded = this.handleSceneLoaded.bind(this);
    this.applyLocalAvatarLayer =
      this.applyLocalAvatarLayer.bind(this);
    window.addEventListener("keydown", this.handleKeyDown);
    this.el.addEventListener("toggle-view", this.toggleView);

    this.setView(this.currentView);

    if (!this.scene?.hasLoaded) {
      this.scene?.addEventListener(
        "loaded",
        this.handleSceneLoaded,
        { once: true }
      );
    }
  },

  cacheElements() {
    this.firstPersonCamera =
      document.querySelector("#first-person-camera") ||
      this.firstPersonCamera;
    this.thirdPersonCamera =
      document.querySelector("#third-person-camera") ||
      this.thirdPersonCamera;
    this.avatar =
      document.querySelector("#local-avatar") ||
      this.avatar;
    this.avatarBody =
      this.avatar?.querySelector(".avatar-model-root") ||
      this.avatarBody;
    this.avatarName =
      this.avatar?.querySelector(".avatar-name") ||
      this.avatarName;
  },

  normalizeView(view) {
    return view === "third" ? "third" : "first";
  },

  isEditableTarget(element) {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element?.isContentEditable
    );
  },

  handleKeyDown(event) {
    if (
      event.code !== "KeyV" ||
      event.repeat ||
      this.isEditableTarget(event.target)
    ) {
      return;
    }

    this.toggleView();
  },

  toggleView() {
    const nextView =
      this.currentView === "first"
        ? "third"
        : "first";

    this.setView(nextView);
  },

  setCameraActive(camera, isActive) {
    if (!camera) {
      return;
    }

    const cameraData = camera.components.camera?.data || {};

    camera.setAttribute("camera", {
      ...cameraData,
      active: isActive
    });
  },

  applyLocalAvatarLayer(object) {
    object.layers.set(1);
  },

  configureCameraLayers() {
    if (!this.avatar) {
      return;
    }

    this.avatar.object3D.traverse(
      this.applyLocalAvatarLayer
    );

    const firstCameraObject =
      this.firstPersonCamera?.getObject3D("camera");
    const thirdCameraObject =
      this.thirdPersonCamera?.getObject3D("camera");

    firstCameraObject?.layers.disable(1);
    thirdCameraObject?.layers.enable(1);
  },

  setAvatarVisible() {
    if (!this.avatar) {
      return;
    }

    this.avatar.setAttribute("visible", "true");
    this.avatar.object3D.visible = true;
    this.avatarBody?.setAttribute("visible", "true");
    this.avatarName?.setAttribute("visible", "true");
    this.configureCameraLayers();
  },

  handleSceneLoaded() {
    this.cacheElements();
    this.setView(this.currentView);
  },

  setFirstPersonLookEnabled(isEnabled) {
    this.firstPersonCamera?.setAttribute(
      "look-controls",
      "enabled",
      isEnabled
    );

    if (!isEnabled && document.pointerLockElement) {
      document.exitPointerLock();
    }
  },

  setView(view) {
    this.cacheElements();

    const normalizedView = this.normalizeView(view);
    const isFirstPerson = normalizedView === "first";

    this.currentView = normalizedView;
    this.setFirstPersonLookEnabled(isFirstPerson);
    this.setCameraActive(this.firstPersonCamera, isFirstPerson);
    this.setCameraActive(this.thirdPersonCamera, !isFirstPerson);
    this.setAvatarVisible();

    if (this.viewLabel) {
      this.viewLabel.textContent = isFirstPerson
        ? "Primera persona"
        : "Tercera persona";
    }

    this.el.emit(
      "view-changed",
      { view: this.currentView }
    );
  },

  tick() {
    const isFirstPerson = this.currentView === "first";
    const firstCamera = this.firstPersonCamera?.components.camera;
    const thirdCamera = this.thirdPersonCamera?.components.camera;

    if (firstCamera?.data.active !== isFirstPerson) {
      this.setCameraActive(
        this.firstPersonCamera,
        isFirstPerson
      );
    }

    if (thirdCamera?.data.active === isFirstPerson) {
      this.setCameraActive(
        this.thirdPersonCamera,
        !isFirstPerson
      );
    }
  },

  remove() {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.el.removeEventListener("toggle-view", this.toggleView);
    this.scene?.removeEventListener(
      "loaded",
      this.handleSceneLoaded
    );
  }
});
