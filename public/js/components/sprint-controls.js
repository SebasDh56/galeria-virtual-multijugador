AFRAME.registerComponent("sprint-controls", {
  schema: {
    normalAcceleration: {
      type: "number",
      default: 22
    },
    sprintAcceleration: {
      type: "number",
      default: 55
    }
  },

  init() {
    this.camera = this.el.querySelector("[camera]");
    this.isSprinting = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  },

  handleKeyDown(event) {
    if (event.code !== "ShiftLeft" && event.code !== "ShiftRight") {
      return;
    }

    if (this.isSprinting) {
      return;
    }

    this.isSprinting = true;
    this.updateAcceleration(this.data.sprintAcceleration);
  },

  handleKeyUp(event) {
    if (event.code !== "ShiftLeft" && event.code !== "ShiftRight") {
      return;
    }

    this.isSprinting = false;
    this.updateAcceleration(this.data.normalAcceleration);
  },

  updateAcceleration(acceleration) {
    if (!this.camera) {
      return;
    }

    this.camera.setAttribute("wasd-controls", {
      acceleration
    });
  },

  remove() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
});