AFRAME.registerComponent("mobile-controls", {
  init() {
    this.interface = document.querySelector("#mobile-controls");
    this.joystick = document.querySelector("#movement-joystick");
    this.joystickKnob =
      document.querySelector("#movement-joystick-knob");
    this.lookZone = document.querySelector("#mobile-look-zone");
    this.sprintButton =
      document.querySelector("#mobile-sprint-button");
    this.jumpButton =
      document.querySelector("#mobile-jump-button");
    this.waveButton =
      document.querySelector("#mobile-wave-button");
    this.viewButton =
      document.querySelector("#mobile-view-button");
    this.interactButton =
      document.querySelector("#mobile-interact-button");

    this.joystickPointerId = null;
    this.lookPointerId = null;
    this.joystickCenterX = 0;
    this.joystickCenterY = 0;
    this.joystickRadius = 1;
    this.lastLookX = 0;
    this.lastLookY = 0;

    this.moveDetail = { x: 0, y: 0 };
    this.lookDetail = { deltaX: 0, deltaY: 0 };
    this.sprintDetail = { active: false };

    this.handleResize = this.handleResize.bind(this);
    this.handleJoystickStart =
      this.handleJoystickStart.bind(this);
    this.handleJoystickMove =
      this.handleJoystickMove.bind(this);
    this.handleJoystickEnd =
      this.handleJoystickEnd.bind(this);
    this.handleLookStart = this.handleLookStart.bind(this);
    this.handleLookMove = this.handleLookMove.bind(this);
    this.handleLookEnd = this.handleLookEnd.bind(this);
    this.startSprint = this.startSprint.bind(this);
    this.stopSprint = this.stopSprint.bind(this);
    this.triggerJump = this.triggerJump.bind(this);
    this.triggerWave = this.triggerWave.bind(this);
    this.toggleView = this.toggleView.bind(this);
    this.interact = this.interact.bind(this);
    this.preventContextMenu =
      this.preventContextMenu.bind(this);

    if (!this.interface) {
      return;
    }

    this.addEventListeners();
    this.updateInterfaceMode();
  },

  addEventListeners() {
    window.addEventListener("resize", this.handleResize);
    this.interface.addEventListener(
      "contextmenu",
      this.preventContextMenu
    );

    this.joystick?.addEventListener(
      "pointerdown",
      this.handleJoystickStart
    );
    this.joystick?.addEventListener(
      "pointermove",
      this.handleJoystickMove
    );
    this.joystick?.addEventListener(
      "pointerup",
      this.handleJoystickEnd
    );
    this.joystick?.addEventListener(
      "pointercancel",
      this.handleJoystickEnd
    );

    this.lookZone?.addEventListener(
      "pointerdown",
      this.handleLookStart
    );
    this.lookZone?.addEventListener(
      "pointermove",
      this.handleLookMove
    );
    this.lookZone?.addEventListener(
      "pointerup",
      this.handleLookEnd
    );
    this.lookZone?.addEventListener(
      "pointercancel",
      this.handleLookEnd
    );

    this.sprintButton?.addEventListener(
      "pointerdown",
      this.startSprint
    );
    this.sprintButton?.addEventListener(
      "pointerup",
      this.stopSprint
    );
    this.sprintButton?.addEventListener(
      "pointercancel",
      this.stopSprint
    );
    this.sprintButton?.addEventListener(
      "pointerleave",
      this.stopSprint
    );

    this.jumpButton?.addEventListener(
      "pointerdown",
      this.triggerJump
    );
    this.waveButton?.addEventListener(
      "pointerdown",
      this.triggerWave
    );
    this.viewButton?.addEventListener(
      "pointerdown",
      this.toggleView
    );
    this.interactButton?.addEventListener(
      "pointerdown",
      this.interact
    );
  },

  removeEventListeners() {
    window.removeEventListener("resize", this.handleResize);
    this.interface?.removeEventListener(
      "contextmenu",
      this.preventContextMenu
    );
    this.joystick?.removeEventListener(
      "pointerdown",
      this.handleJoystickStart
    );
    this.joystick?.removeEventListener(
      "pointermove",
      this.handleJoystickMove
    );
    this.joystick?.removeEventListener(
      "pointerup",
      this.handleJoystickEnd
    );
    this.joystick?.removeEventListener(
      "pointercancel",
      this.handleJoystickEnd
    );
    this.lookZone?.removeEventListener(
      "pointerdown",
      this.handleLookStart
    );
    this.lookZone?.removeEventListener(
      "pointermove",
      this.handleLookMove
    );
    this.lookZone?.removeEventListener(
      "pointerup",
      this.handleLookEnd
    );
    this.lookZone?.removeEventListener(
      "pointercancel",
      this.handleLookEnd
    );
    this.sprintButton?.removeEventListener(
      "pointerdown",
      this.startSprint
    );
    this.sprintButton?.removeEventListener(
      "pointerup",
      this.stopSprint
    );
    this.sprintButton?.removeEventListener(
      "pointercancel",
      this.stopSprint
    );
    this.sprintButton?.removeEventListener(
      "pointerleave",
      this.stopSprint
    );
    this.jumpButton?.removeEventListener(
      "pointerdown",
      this.triggerJump
    );
    this.waveButton?.removeEventListener(
      "pointerdown",
      this.triggerWave
    );
    this.viewButton?.removeEventListener(
      "pointerdown",
      this.toggleView
    );
    this.interactButton?.removeEventListener(
      "pointerdown",
      this.interact
    );
  },

  preventContextMenu(event) {
    event.preventDefault();
  },

  handleResize() {
    this.updateInterfaceMode();
  },

  updateInterfaceMode() {
    const isTouchLayout =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 900;

    document.body.classList.toggle(
      "touch-interface",
      isTouchLayout
    );
    this.interface.setAttribute(
      "aria-hidden",
      String(!isTouchLayout)
    );

    if (!isTouchLayout) {
      this.resetJoystick();
      this.stopSprint();
    }
  },

  handleJoystickStart(event) {
    event.preventDefault();
    this.joystickPointerId = event.pointerId;
    this.joystick.setPointerCapture(event.pointerId);

    const bounds = this.joystick.getBoundingClientRect();

    this.joystickCenterX = bounds.left + bounds.width / 2;
    this.joystickCenterY = bounds.top + bounds.height / 2;
    this.joystickRadius = bounds.width * 0.32;
    this.updateJoystick(event.clientX, event.clientY);
  },

  handleJoystickMove(event) {
    if (event.pointerId !== this.joystickPointerId) {
      return;
    }

    event.preventDefault();
    this.updateJoystick(event.clientX, event.clientY);
  },

  updateJoystick(clientX, clientY) {
    const rawX = clientX - this.joystickCenterX;
    const rawY = clientY - this.joystickCenterY;
    const distance = Math.hypot(rawX, rawY);
    const scale =
      distance > this.joystickRadius
        ? this.joystickRadius / distance
        : 1;
    const offsetX = rawX * scale;
    const offsetY = rawY * scale;

    this.joystickKnob.style.transform =
      `translate(${offsetX}px, ${offsetY}px)`;
    this.moveDetail.x = offsetX / this.joystickRadius;
    this.moveDetail.y = -offsetY / this.joystickRadius;
    this.el.emit("mobile-move", this.moveDetail);
  },

  handleJoystickEnd(event) {
    if (event.pointerId !== this.joystickPointerId) {
      return;
    }

    if (this.joystick.hasPointerCapture(event.pointerId)) {
      this.joystick.releasePointerCapture(event.pointerId);
    }
    this.resetJoystick();
  },

  resetJoystick() {
    this.joystickPointerId = null;
    this.moveDetail.x = 0;
    this.moveDetail.y = 0;

    if (this.joystickKnob) {
      this.joystickKnob.style.transform = "translate(0, 0)";
    }

    this.el.emit("mobile-move", this.moveDetail);
  },

  handleLookStart(event) {
    event.preventDefault();
    this.lookPointerId = event.pointerId;
    this.lastLookX = event.clientX;
    this.lastLookY = event.clientY;
    this.lookZone.setPointerCapture(event.pointerId);
  },

  handleLookMove(event) {
    if (event.pointerId !== this.lookPointerId) {
      return;
    }

    event.preventDefault();
    this.lookDetail.deltaX = event.clientX - this.lastLookX;
    this.lookDetail.deltaY = event.clientY - this.lastLookY;
    this.lastLookX = event.clientX;
    this.lastLookY = event.clientY;
    this.el.emit("mobile-look", this.lookDetail);
  },

  handleLookEnd(event) {
    if (event.pointerId !== this.lookPointerId) {
      return;
    }

    if (this.lookZone.hasPointerCapture(event.pointerId)) {
      this.lookZone.releasePointerCapture(event.pointerId);
    }
    this.lookPointerId = null;
  },

  startSprint(event) {
    event.preventDefault();
    this.sprintDetail.active = true;
    this.sprintButton.classList.add("is-active");
    this.el.emit("mobile-sprint", this.sprintDetail);
  },

  stopSprint() {
    this.sprintDetail.active = false;
    this.sprintButton?.classList.remove("is-active");
    this.el.emit("mobile-sprint", this.sprintDetail);
  },

  triggerJump(event) {
    event.preventDefault();
    this.el.emit("mobile-jump");
  },

  triggerWave(event) {
    event.preventDefault();
    this.el.emit("mobile-wave");
  },

  toggleView(event) {
    event.preventDefault();
    this.el.emit("toggle-view");
  },

  interact(event) {
    event.preventDefault();

    const firstCamera =
      this.el.querySelector("#first-person-camera");
    const activeCamera =
      firstCamera?.components.camera?.data.active
        ? firstCamera
        : this.el.querySelector("#third-person-camera");
    const cursor = activeCamera?.querySelector("a-cursor");
    const intersectedElements =
      cursor?.components.raycaster?.intersectedEls || [];
    const artwork = intersectedElements.find((element) =>
      element.classList.contains("interactive-artwork")
    );

    artwork?.emit("click");
  },

  remove() {
    this.removeEventListeners();
    this.resetJoystick();
    this.stopSprint();
    document.body.classList.remove("touch-interface");
  }
});
