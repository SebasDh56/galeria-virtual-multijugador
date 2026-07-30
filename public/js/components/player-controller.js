AFRAME.registerComponent("player-controller", {
  schema: {
    walkSpeed: { type: "number", default: 3.2 },
    sprintSpeed: { type: "number", default: 6.2 },
    acceleration: { type: "number", default: 9 },
    deceleration: { type: "number", default: 12 },
    rotationSpeed: { type: "number", default: 10 }
  },

  init() {
    this.keys = {};

    this.velocity = new THREE.Vector3();
    this.inputDirection = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.targetDirection = new THREE.Vector3();

    this.firstPersonCamera =
      document.querySelector("#first-person-camera");

    this.thirdPersonCamera =
      document.querySelector("#third-person-camera");

    this.avatar =
      document.querySelector("#local-avatar");

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  },

  handleKeyDown(event) {
    const element = event.target;

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      return;
    }

    this.keys[event.code] = true;
  },

  handleKeyUp(event) {
    this.keys[event.code] = false;
  },

  getActiveCamera() {
    const firstCameraData =
      this.firstPersonCamera?.getAttribute("camera");

    return firstCameraData?.active
      ? this.firstPersonCamera
      : this.thirdPersonCamera;
  },

  getMovementInput() {
    const horizontal =
      Number(Boolean(this.keys.KeyD || this.keys.ArrowRight)) -
      Number(Boolean(this.keys.KeyA || this.keys.ArrowLeft));

    const vertical =
      Number(Boolean(this.keys.KeyW || this.keys.ArrowUp)) -
      Number(Boolean(this.keys.KeyS || this.keys.ArrowDown));

    return { horizontal, vertical };
  },

  isSprinting() {
    return Boolean(
      this.keys.ShiftLeft || this.keys.ShiftRight
    );
  },

  rotateAvatar(deltaSeconds) {
    if (!this.avatar || this.targetDirection.lengthSq() === 0) {
      return;
    }

    const targetAngle = Math.atan2(
      this.targetDirection.x,
      this.targetDirection.z
    );

    const currentQuaternion = this.avatar.object3D.quaternion;

    const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      targetAngle
    );

    currentQuaternion.slerp(
      targetQuaternion,
      Math.min(1, this.data.rotationSpeed * deltaSeconds)
    );
  },

  tick(time, deltaTime) {
    if (!deltaTime) {
      return;
    }

    const deltaSeconds = Math.min(deltaTime / 1000, 0.05);
    const camera = this.getActiveCamera();

    if (!camera) {
      return;
    }

    const { horizontal, vertical } = this.getMovementInput();
    const hasInput = horizontal !== 0 || vertical !== 0;

    camera.object3D.getWorldDirection(this.forward);
    this.forward.y = 0;

    if (this.forward.lengthSq() > 0) {
      this.forward.normalize();
    }

    this.right
      .crossVectors(this.forward, new THREE.Vector3(0, 1, 0))
      .normalize();

    this.inputDirection.set(0, 0, 0);

    if (vertical !== 0) {
      this.inputDirection.addScaledVector(
        this.forward,
        vertical
      );
    }

    if (horizontal !== 0) {
      this.inputDirection.addScaledVector(
        this.right,
        horizontal
      );
    }

    if (this.inputDirection.lengthSq() > 0) {
      this.inputDirection.normalize();
      this.targetDirection.copy(this.inputDirection);
    }

    const maximumSpeed = this.isSprinting()
      ? this.data.sprintSpeed
      : this.data.walkSpeed;

    const desiredVelocity = hasInput
      ? this.inputDirection
          .clone()
          .multiplyScalar(maximumSpeed)
      : new THREE.Vector3();

    const changeRate = hasInput
      ? this.data.acceleration
      : this.data.deceleration;

    const interpolation =
      1 - Math.exp(-changeRate * deltaSeconds);

    this.velocity.lerp(
      desiredVelocity,
      interpolation
    );

    const movement = this.velocity
      .clone()
      .multiplyScalar(deltaSeconds);

    this.el.object3D.position.add(movement);

    const speed = this.velocity.length();

    if (speed > 0.1) {
      this.rotateAvatar(deltaSeconds);
    }

    this.el.emit("player-motion", {
      speed,
      isMoving: speed > 0.1,
      isSprinting:
        this.isSprinting() && speed > this.data.walkSpeed
    });
  },

  remove() {
    window.removeEventListener(
      "keydown",
      this.handleKeyDown
    );

    window.removeEventListener(
      "keyup",
      this.handleKeyUp
    );
  }
});