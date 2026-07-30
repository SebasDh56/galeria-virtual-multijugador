AFRAME.registerComponent("view-switcher", {
  schema: {
    defaultView: {
      type: "string",
      default: "first"
    }
  },

  init() {
    this.firstPersonCamera =
      document.querySelector("#first-person-camera");

    this.thirdPersonCamera =
      document.querySelector("#third-person-camera");

    this.avatar =
      document.querySelector("#local-avatar");

    this.viewLabel =
      document.querySelector("#current-view-label");

    this.currentView = this.data.defaultView;

    this.handleKeyDown = this.handleKeyDown.bind(this);

    window.addEventListener(
      "keydown",
      this.handleKeyDown
    );

    this.setView(this.currentView);
  },

  handleKeyDown(event) {
    if (event.code !== "KeyV" || event.repeat) {
      return;
    }

    const target = event.target;

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const nextView =
      this.currentView === "first"
        ? "third"
        : "first";

    this.setView(nextView);
  },

  setView(view) {
    const isFirstPerson = view === "first";

    this.currentView = isFirstPerson
      ? "first"
      : "third";

    this.firstPersonCamera.setAttribute(
      "camera",
      "active",
      isFirstPerson
    );

    this.thirdPersonCamera.setAttribute(
      "camera",
      "active",
      !isFirstPerson
    );

    // Oculta el cuerpo local en primera persona para evitar
    // que la cámara quede dentro de la cabeza del avatar.
    this.avatar.setAttribute(
      "visible",
      !isFirstPerson
    );

    if (this.viewLabel) {
      this.viewLabel.textContent = isFirstPerson
        ? "Primera persona"
        : "Tercera persona";
    }

    this.el.emit("view-changed", {
      view: this.currentView
    });

    console.log(
      `Vista activa: ${this.currentView}`
    );
  },

  remove() {
    window.removeEventListener(
      "keydown",
      this.handleKeyDown
    );
  }
});