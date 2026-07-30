AFRAME.registerComponent("avatar-animator", {
  schema: {
    walkFrequency: { type: "number", default: 8 },
    sprintFrequency: { type: "number", default: 12 },
    walkAmplitude: { type: "number", default: 25 },
    sprintAmplitude: { type: "number", default: 38 }
  },

  init() {
    this.leftArm = this.el.querySelector(".avatar-left-arm");
    this.rightArm = this.el.querySelector(".avatar-right-arm");
    this.leftLeg = this.el.querySelector(".avatar-left-leg");
    this.rightLeg = this.el.querySelector(".avatar-right-leg");
    this.body = this.el.querySelector(".avatar-body");

    this.isMoving = false;
    this.isSprinting = false;
    this.speed = 0;
    this.elapsedTime = 0;

    this.playerRig = document.querySelector("#player-rig");

    this.handleMotion = this.handleMotion.bind(this);

    this.playerRig?.addEventListener(
      "player-motion",
      this.handleMotion
    );
  },

  handleMotion(event) {
    this.isMoving = event.detail.isMoving;
    this.isSprinting = event.detail.isSprinting;
    this.speed = event.detail.speed;
  },

  setRotation(element, x, y = 0, z = 0) {
    if (!element) {
      return;
    }

    element.object3D.rotation.set(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z)
    );
  },

  tick(time, deltaTime) {
    const deltaSeconds = Math.min(
      (deltaTime || 0) / 1000,
      0.05
    );

    if (!this.isMoving) {
      this.setRotation(this.leftArm, 0, 0, -5);
      this.setRotation(this.rightArm, 0, 0, 5);
      this.setRotation(this.leftLeg, 0);
      this.setRotation(this.rightLeg, 0);

      if (this.body) {
        this.body.object3D.position.y =
          THREE.MathUtils.lerp(
            this.body.object3D.position.y,
            1.25,
            0.15
          );
      }

      return;
    }

    const frequency = this.isSprinting
      ? this.data.sprintFrequency
      : this.data.walkFrequency;

    const amplitude = this.isSprinting
      ? this.data.sprintAmplitude
      : this.data.walkAmplitude;

    this.elapsedTime += deltaSeconds * frequency;

    const cycle = Math.sin(this.elapsedTime);
    const oppositeCycle = Math.sin(this.elapsedTime + Math.PI);

    this.setRotation(
      this.leftArm,
      cycle * amplitude,
      0,
      -5
    );

    this.setRotation(
      this.rightArm,
      oppositeCycle * amplitude,
      0,
      5
    );

    this.setRotation(
      this.leftLeg,
      oppositeCycle * amplitude * 0.7
    );

    this.setRotation(
      this.rightLeg,
      cycle * amplitude * 0.7
    );

    if (this.body) {
      const bodyBounce =
        Math.abs(Math.sin(this.elapsedTime * 2)) * 0.035;

      this.body.object3D.position.y =
        1.25 + bodyBounce;
    }
  },

  remove() {
    this.playerRig?.removeEventListener(
      "player-motion",
      this.handleMotion
    );
  }
});