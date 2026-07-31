AFRAME.registerComponent("player-controller", {
  schema: {
    walkSpeed: { type: "number", default: 3.2 },
    sprintSpeed: { type: "number", default: 6.2 },
    acceleration: { type: "number", default: 9 },
    deceleration: { type: "number", default: 12 },
    rotationSpeed: { type: "number", default: 10 },
    jumpVelocity: { type: "number", default: 5 },
    gravity: { type: "number", default: 14 },
    groundHeight: { type: "number", default: 0.12 },
    touchLookSensitivity: { type: "number", default: 0.004 },
    collisionEnabled: { type: "boolean", default: true }
  },

  init() {
    this.keys = Object.create(null);
    this.velocity = new THREE.Vector3();
    this.desiredVelocity = new THREE.Vector3();
    this.movementStep = new THREE.Vector3();
    this.inputDirection = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.targetDirection = new THREE.Vector3(0, 0, -1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.targetQuaternion = new THREE.Quaternion();
    this.walkableZones = [];
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.mobileSprint = false;
    this.mobileCameraYaw = 0;
    this.mobileCameraPitch = 0;
    this.hasMobileCameraRotation = false;

    this.mobileInput = {
      horizontal: 0,
      vertical: 0
    };

    this.movementInput = {
      horizontal: 0,
      vertical: 0
    };

    this.motionDetail = {
      speed: 0,
      isMoving: false,
      isSprinting: false,
      isJumping: false
    };

    this.waveActionDetail = { action: "wave" };

    this.firstPersonCamera =
      this.el.querySelector("#first-person-camera");
    this.thirdPersonCamera =
      this.el.querySelector("#third-person-camera");
    this.avatar = this.el.querySelector("#local-avatar");

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleMobileMove = this.handleMobileMove.bind(this);
    this.handleMobileSprint =
      this.handleMobileSprint.bind(this);
    this.handleMobileLook = this.handleMobileLook.bind(this);
    this.startJump = this.startJump.bind(this);
    this.triggerWave = this.triggerWave.bind(this);
    this.cacheWalkableZones =
      this.cacheWalkableZones.bind(this);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
    this.el.addEventListener(
      "mobile-move",
      this.handleMobileMove
    );
    this.el.addEventListener(
      "mobile-sprint",
      this.handleMobileSprint
    );
    this.el.addEventListener(
      "mobile-look",
      this.handleMobileLook
    );
    this.el.addEventListener("mobile-jump", this.startJump);
    this.el.addEventListener("mobile-wave", this.triggerWave);

    this.cacheWalkableZones();
    this.el.sceneEl?.addEventListener(
      "gallery-built",
      this.cacheWalkableZones
    );
  },

  isEditableTarget(element) {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element?.isContentEditable
    );
  },

  handleKeyDown(event) {
    if (this.isEditableTarget(event.target)) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();

      if (!event.repeat) {
        this.startJump();
      }

      return;
    }

    if (event.code === "KeyH") {
      if (!event.repeat) {
        this.triggerWave();
      }

      return;
    }

    this.keys[event.code] = true;
  },

  handleKeyUp(event) {
    this.keys[event.code] = false;
  },

  handleWindowBlur() {
    this.keys = Object.create(null);
    this.mobileInput.horizontal = 0;
    this.mobileInput.vertical = 0;
    this.mobileSprint = false;
  },

  handleMobileMove(event) {
    this.mobileInput.horizontal = THREE.MathUtils.clamp(
      Number(event.detail?.x) || 0,
      -1,
      1
    );
    this.mobileInput.vertical = THREE.MathUtils.clamp(
      Number(event.detail?.y) || 0,
      -1,
      1
    );
  },

  handleMobileSprint(event) {
    this.mobileSprint = Boolean(event.detail?.active);
  },

  handleMobileLook(event) {
    const deltaX = Number(event.detail?.deltaX) || 0;
    const deltaY = Number(event.detail?.deltaY) || 0;
    const firstCamera = this.firstPersonCamera?.components.camera;
    const isFirstPerson = Boolean(firstCamera?.data.active);

    if (isFirstPerson && this.firstPersonCamera) {
      const cameraRotation =
        this.firstPersonCamera.object3D.rotation;
      const lookControls =
        this.firstPersonCamera.components["look-controls"];
      const yawRotation = lookControls?.yawObject?.rotation;
      const pitchRotation =
        lookControls?.pitchObject?.rotation;

      if (!this.hasMobileCameraRotation) {
        this.mobileCameraYaw =
          yawRotation?.y ?? cameraRotation.y;
        this.mobileCameraPitch =
          pitchRotation?.x ?? cameraRotation.x;
        this.hasMobileCameraRotation = true;
      }

      this.mobileCameraYaw -=
        deltaX * this.data.touchLookSensitivity;
      this.mobileCameraPitch = THREE.MathUtils.clamp(
        this.mobileCameraPitch -
          deltaY * this.data.touchLookSensitivity,
        -1.25,
        1.25
      );

      if (yawRotation && pitchRotation) {
        yawRotation.y = this.mobileCameraYaw;
        pitchRotation.x = this.mobileCameraPitch;
      }

      return;
    }

    if (this.avatar) {
      const avatarRotation =
        this.avatar.object3D.rotation.y -
        deltaX * this.data.touchLookSensitivity;

      this.avatar.object3D.rotation.y = avatarRotation;
      this.targetDirection.set(
        Math.sin(avatarRotation),
        0,
        Math.cos(avatarRotation)
      );
    }

    this.thirdPersonCamera?.components[
      "third-person-camera"
    ]?.addPitchInput(
      deltaY * this.data.touchLookSensitivity
    );
  },

  startJump() {
    if (!this.isGrounded) {
      return;
    }

    this.isGrounded = false;
    this.verticalVelocity = this.data.jumpVelocity;
  },

  triggerWave() {
    this.el.emit("player-action", this.waveActionDetail);
  },

  updateVerticalMovement(deltaSeconds) {
    if (this.isGrounded) {
      return;
    }

    this.verticalVelocity -=
      this.data.gravity * deltaSeconds;
    this.el.object3D.position.y +=
      this.verticalVelocity * deltaSeconds;

    if (
      this.el.object3D.position.y <= this.data.groundHeight
    ) {
      this.el.object3D.position.y = this.data.groundHeight;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }
  },

  cacheWalkableZones() {
    const zoneElements = document.querySelectorAll(
      ".gallery-walkable-zone"
    );

    this.walkableZones = Array.from(zoneElements, (element) => ({
      minX: Number(element.dataset.minX),
      maxX: Number(element.dataset.maxX),
      minZ: Number(element.dataset.minZ),
      maxZ: Number(element.dataset.maxZ)
    }));
  },

  isWalkable(x, z) {
    if (
      !this.data.collisionEnabled ||
      this.walkableZones.length === 0
    ) {
      return true;
    }

    for (let index = 0; index < this.walkableZones.length; index += 1) {
      const zone = this.walkableZones[index];

      if (
        x >= zone.minX &&
        x <= zone.maxX &&
        z >= zone.minZ &&
        z <= zone.maxZ
      ) {
        return true;
      }
    }

    return false;
  },

  applyMovement() {
    const position = this.el.object3D.position;
    const nextX = position.x + this.movementStep.x;
    const nextZ = position.z + this.movementStep.z;

    if (this.isWalkable(nextX, nextZ)) {
      position.x = nextX;
      position.z = nextZ;
      return;
    }

    if (this.isWalkable(nextX, position.z)) {
      position.x = nextX;
    } else {
      this.velocity.x = 0;
    }

    if (this.isWalkable(position.x, nextZ)) {
      position.z = nextZ;
    } else {
      this.velocity.z = 0;
    }
  },

  getActiveCamera() {
    const firstCamera = this.firstPersonCamera?.components.camera;

    return firstCamera?.data.active
      ? this.firstPersonCamera
      : this.thirdPersonCamera;
  },

  getMovementInput() {
    const keyboardHorizontal =
      Number(Boolean(this.keys.KeyD || this.keys.ArrowRight)) -
      Number(Boolean(this.keys.KeyA || this.keys.ArrowLeft));

    const keyboardVertical =
      Number(Boolean(this.keys.KeyW || this.keys.ArrowUp)) -
      Number(Boolean(this.keys.KeyS || this.keys.ArrowDown));

    this.movementInput.horizontal = THREE.MathUtils.clamp(
      keyboardHorizontal + this.mobileInput.horizontal,
      -1,
      1
    );
    this.movementInput.vertical = THREE.MathUtils.clamp(
      keyboardVertical + this.mobileInput.vertical,
      -1,
      1
    );

    return this.movementInput;
  },

  isSprinting() {
    return Boolean(
      this.keys.ShiftLeft ||
      this.keys.ShiftRight ||
      this.mobileSprint
    );
  },

  getCameraObject(camera) {
    return camera.getObject3D("camera") || camera.object3D;
  },

  updateMovementDirection(camera, horizontal, vertical) {
    const cameraObject = this.getCameraObject(camera);

    cameraObject.getWorldDirection(this.forward);
    this.forward.y = 0;

    if (this.forward.lengthSq() > 0) {
      this.forward.normalize();
    }

    this.right
      .crossVectors(this.forward, this.up)
      .normalize();

    this.inputDirection.set(0, 0, 0);
    this.inputDirection.addScaledVector(this.forward, vertical);
    this.inputDirection.addScaledVector(this.right, horizontal);

    if (this.inputDirection.lengthSq() > 0) {
      this.inputDirection.normalize();
      this.targetDirection.copy(this.inputDirection);
    }
  },

  updateVelocity(hasInput, maximumSpeed, deltaSeconds) {
    if (hasInput) {
      this.desiredVelocity
        .copy(this.inputDirection)
        .multiplyScalar(maximumSpeed);
    } else {
      this.desiredVelocity.set(0, 0, 0);
    }

    const changeRate = hasInput
      ? this.data.acceleration
      : this.data.deceleration;

    const interpolation = 1 - Math.exp(-changeRate * deltaSeconds);

    this.velocity.lerp(this.desiredVelocity, interpolation);

    if (!hasInput && this.velocity.lengthSq() < 0.0001) {
      this.velocity.set(0, 0, 0);
    }
  },

  rotateAvatar(deltaSeconds) {
    if (!this.avatar || this.targetDirection.lengthSq() === 0) {
      return;
    }

    const targetAngle = Math.atan2(
      this.targetDirection.x,
      this.targetDirection.z
    );

    this.targetQuaternion.setFromAxisAngle(this.up, targetAngle);
    this.avatar.object3D.quaternion.slerp(
      this.targetQuaternion,
      Math.min(1, this.data.rotationSpeed * deltaSeconds)
    );
  },

  emitMotionState(speed, isSprinting) {
    this.motionDetail.speed = speed;
    this.motionDetail.isMoving = speed > 0.1;
    this.motionDetail.isSprinting =
      isSprinting && speed > this.data.walkSpeed;
    this.motionDetail.isJumping = !this.isGrounded;

    this.el.emit("player-motion", this.motionDetail);
  },

  tick(time, deltaTime) {
    if (!deltaTime) {
      return;
    }

    const camera = this.getActiveCamera();

    if (!camera) {
      return;
    }

    const deltaSeconds = Math.min(deltaTime / 1000, 0.05);
    const { horizontal, vertical } = this.getMovementInput();
    const hasInput = horizontal !== 0 || vertical !== 0;
    const sprinting = this.isSprinting();
    const maximumSpeed = sprinting
      ? this.data.sprintSpeed
      : this.data.walkSpeed;

    this.updateMovementDirection(
      camera,
      horizontal,
      vertical
    );

    this.updateVelocity(
      hasInput,
      maximumSpeed,
      deltaSeconds
    );

    this.movementStep
      .copy(this.velocity)
      .multiplyScalar(deltaSeconds);

    this.applyMovement();
    this.updateVerticalMovement(deltaSeconds);

    const speed = this.velocity.length();

    if (speed > 0.1) {
      this.rotateAvatar(deltaSeconds);
    }

    this.emitMotionState(speed, sprinting);
  },

  tock() {
    if (
      !this.hasMobileCameraRotation ||
      !document.body.classList.contains("touch-interface") ||
      !this.firstPersonCamera?.components.camera?.data.active
    ) {
      return;
    }

    this.firstPersonCamera.object3D.rotation.set(
      this.mobileCameraPitch,
      this.mobileCameraYaw,
      0
    );
  },

  remove() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
    this.el.removeEventListener(
      "mobile-move",
      this.handleMobileMove
    );
    this.el.removeEventListener(
      "mobile-sprint",
      this.handleMobileSprint
    );
    this.el.removeEventListener(
      "mobile-look",
      this.handleMobileLook
    );
    this.el.removeEventListener("mobile-jump", this.startJump);
    this.el.removeEventListener("mobile-wave", this.triggerWave);
    this.el.sceneEl?.removeEventListener(
      "gallery-built",
      this.cacheWalkableZones
    );
  }
});
