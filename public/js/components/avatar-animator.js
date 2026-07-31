AFRAME.registerComponent("avatar-animator", {
  schema: {
    walkFrequency: { type: "number", default: 8 },
    sprintFrequency: { type: "number", default: 12 },
    walkAmplitude: { type: "number", default: 25 },
    sprintAmplitude: { type: "number", default: 38 },
    transitionSpeed: { type: "number", default: 10 },
    referenceWalkSpeed: { type: "number", default: 3.2 },
    waveDuration: { type: "number", default: 1.45 },
    motionSource: { type: "selector" },
    idleClip: { type: "string", default: "Idle" },
    walkClip: { type: "string", default: "Walk" },
    sprintClip: { type: "string", default: "Run" }
  },

  init() {
    this.isMoving = false;
    this.isSprinting = false;
    this.isJumping = false;
    this.speed = 0;
    this.elapsedTime = 0;
    this.motionBlend = 0;
    this.sprintBlend = 0;
    this.animationState = "";
    this.mixer = null;
    this.activeAction = null;
    this.actions = Object.create(null);
    this.waveTimeRemaining = 0;

    this.cacheProceduralParts();

    this.playerRig =
      this.data.motionSource ||
      this.el.closest("[player-controller]") ||
      this.el;
    this.handleMotion = this.handleMotion.bind(this);
    this.handleAction = this.handleAction.bind(this);
    this.handleModelLoaded = this.handleModelLoaded.bind(this);

    this.playerRig?.addEventListener(
      "player-motion",
      this.handleMotion
    );
    this.playerRig?.addEventListener(
      "player-action",
      this.handleAction
    );

    this.el.addEventListener(
      "model-loaded",
      this.handleModelLoaded
    );
  },

  cacheProceduralParts() {
    this.leftArm = this.el.querySelector(
      '[data-avatar-part="left-arm"], .avatar-left-arm'
    );
    this.rightArm = this.el.querySelector(
      '[data-avatar-part="right-arm"], .avatar-right-arm'
    );
    this.leftLeg = this.el.querySelector(
      '[data-avatar-part="left-leg"], .avatar-left-leg'
    );
    this.rightLeg = this.el.querySelector(
      '[data-avatar-part="right-leg"], .avatar-right-leg'
    );
    this.body = this.el.querySelector(".avatar-body");
    this.baseBodyY = this.body?.object3D.position.y || 0;
  },

  handleMotion(event) {
    const wasJumping = this.isJumping;

    this.isMoving = event.detail.isMoving;
    this.isSprinting = event.detail.isSprinting;
    this.isJumping = Boolean(event.detail.isJumping);
    this.speed = event.detail.speed;

    if (wasJumping && !this.isJumping) {
      this.setRotation(this.leftLeg, 0);
      this.setRotation(this.rightLeg, 0);
    }
  },

  handleAction(event) {
    if (event.detail?.action === "wave") {
      this.waveTimeRemaining = this.data.waveDuration;
    }
  },

  findClip(clips, expectedName) {
    const normalizedName = expectedName.toLowerCase();

    return clips.find(
      (clip) => clip.name.toLowerCase() === normalizedName
    ) || clips.find(
      (clip) => clip.name.toLowerCase().includes(normalizedName)
    );
  },

  handleModelLoaded(event) {
    const model =
      event.detail.model ||
      event.target.getObject3D("mesh");
    const clips = model?.animations || [];

    if (!model || clips.length === 0) {
      this.cacheProceduralParts();
      return;
    }

    this.mixer = new THREE.AnimationMixer(model);

    const clipNames = {
      idle: this.data.idleClip,
      walk: this.data.walkClip,
      sprint: this.data.sprintClip
    };

    Object.entries(clipNames).forEach(([state, name]) => {
      const clip = this.findClip(clips, name);

      if (clip) {
        this.actions[state] = this.mixer.clipAction(clip);
      }
    });

    this.setModelAnimation("idle");
  },

  setModelAnimation(state) {
    const nextAction =
      this.actions[state] ||
      this.actions.walk ||
      this.actions.idle;

    if (!nextAction || nextAction === this.activeAction) {
      return;
    }

    nextAction.reset().fadeIn(0.18).play();
    this.activeAction?.fadeOut(0.18);
    this.activeAction = nextAction;
  },

  damp(current, target, speed, deltaSeconds) {
    const interpolation = 1 - Math.exp(-speed * deltaSeconds);
    return THREE.MathUtils.lerp(current, target, interpolation);
  },

  setRotation(element, x, z = 0) {
    if (!element) {
      return;
    }

    element.object3D.rotation.set(
      THREE.MathUtils.degToRad(x),
      0,
      THREE.MathUtils.degToRad(z)
    );
  },

  updateModelAnimation(deltaSeconds) {
    const state = !this.isMoving
      ? "idle"
      : this.isSprinting
        ? "sprint"
        : "walk";

    if (state !== this.animationState) {
      this.animationState = state;
      this.setModelAnimation(state);
    }

    this.mixer.update(deltaSeconds);
  },

  updateProceduralAnimation(deltaSeconds) {
    const targetMotionBlend = this.isMoving
      ? Math.min(1, this.speed / this.data.referenceWalkSpeed)
      : 0;

    this.motionBlend = this.damp(
      this.motionBlend,
      targetMotionBlend,
      this.data.transitionSpeed,
      deltaSeconds
    );

    this.sprintBlend = this.damp(
      this.sprintBlend,
      this.isSprinting ? 1 : 0,
      this.data.transitionSpeed,
      deltaSeconds
    );

    if (!this.isMoving && this.motionBlend < 0.002) {
      this.motionBlend = 0;
    }

    if (!this.isSprinting && this.sprintBlend < 0.002) {
      this.sprintBlend = 0;
    }

    const frequency = THREE.MathUtils.lerp(
      this.data.walkFrequency,
      this.data.sprintFrequency,
      this.sprintBlend
    );

    const amplitude = THREE.MathUtils.lerp(
      this.data.walkAmplitude,
      this.data.sprintAmplitude,
      this.sprintBlend
    ) * this.motionBlend;

    this.elapsedTime +=
      deltaSeconds * frequency * Math.max(0.25, this.motionBlend);

    const cycle = Math.sin(this.elapsedTime);
    const oppositeCycle = -cycle;
    const armRestAngle = 5 * (1 - this.motionBlend);

    this.setRotation(
      this.leftArm,
      cycle * amplitude,
      -armRestAngle
    );

    this.setRotation(
      this.rightArm,
      oppositeCycle * amplitude,
      armRestAngle
    );

    this.setRotation(
      this.leftLeg,
      oppositeCycle * amplitude * 0.72
    );

    this.setRotation(
      this.rightLeg,
      cycle * amplitude * 0.72
    );

    if (this.body) {
      if (this.motionBlend === 0) {
        this.body.object3D.position.y = this.baseBodyY;
        this.body.object3D.rotation.x = 0;
        return;
      }

      const bounce =
        Math.abs(Math.sin(this.elapsedTime * 2)) *
        0.045 *
        this.motionBlend;

      this.body.object3D.position.y = this.damp(
        this.body.object3D.position.y,
        this.baseBodyY + bounce,
        this.data.transitionSpeed,
        deltaSeconds
      );

      this.body.object3D.rotation.x = this.damp(
        this.body.object3D.rotation.x,
        THREE.MathUtils.degToRad(-7 * this.sprintBlend),
        this.data.transitionSpeed,
        deltaSeconds
      );
    }
  },

  updateActionPose(deltaSeconds) {
    if (this.isJumping) {
      this.setRotation(this.leftLeg, -24);
      this.setRotation(this.rightLeg, -24);
      this.setRotation(this.leftArm, 18, -8);
    }

    if (this.waveTimeRemaining <= 0) {
      return;
    }

    this.waveTimeRemaining = Math.max(
      0,
      this.waveTimeRemaining - deltaSeconds
    );

    const waveProgress =
      1 - this.waveTimeRemaining / this.data.waveDuration;
    const waveCycle = Math.sin(waveProgress * Math.PI * 6);

    if (this.rightArm) {
      this.rightArm.object3D.rotation.set(
        THREE.MathUtils.degToRad(-18 + waveCycle * 16),
        0,
        THREE.MathUtils.degToRad(138 + waveCycle * 8)
      );
    }

    if (this.waveTimeRemaining === 0 && !this.isMoving) {
      this.setRotation(this.rightArm, 0, 5);
    }
  },

  tick(time, deltaTime) {
    if (!deltaTime) {
      return;
    }

    const deltaSeconds = Math.min(deltaTime / 1000, 0.05);

    if (this.mixer) {
      this.updateModelAnimation(deltaSeconds);
      return;
    }

    if (
      !this.isMoving &&
      this.motionBlend === 0 &&
      this.sprintBlend === 0 &&
      !this.isJumping &&
      this.waveTimeRemaining === 0
    ) {
      return;
    }

    this.updateProceduralAnimation(deltaSeconds);
    this.updateActionPose(deltaSeconds);
  },

  remove() {
    this.playerRig?.removeEventListener(
      "player-motion",
      this.handleMotion
    );
    this.playerRig?.removeEventListener(
      "player-action",
      this.handleAction
    );

    this.el.removeEventListener(
      "model-loaded",
      this.handleModelLoaded
    );

    this.mixer?.stopAllAction();
  }
});
