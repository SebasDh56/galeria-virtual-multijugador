AFRAME.registerComponent("third-person-camera", {
  schema: {
    target: { type: "selector" },
    distance: { type: "number", default: 4.5 },
    height: { type: "number", default: 2.7 },
    smoothness: { type: "number", default: 8 },
    lookAtHeight: { type: "number", default: 1.35 },
    mobilePitchLimit: { type: "number", default: 1.1 }
  },

  init() {
    this.target =
      this.data.target ||
      document.querySelector("#local-avatar");

    this.targetWorldPosition = new THREE.Vector3();
    this.worldLookTarget = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.localLookTarget = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();
    this.desiredQuaternion = new THREE.Quaternion();
    this.lookHelper = new THREE.PerspectiveCamera();
    this.hasInitialPosition = false;
    this.pitchOffset = 0;
  },

  update() {
    this.target =
      this.data.target ||
      document.querySelector("#local-avatar");
  },

  addPitchInput(delta) {
    this.pitchOffset = THREE.MathUtils.clamp(
      this.pitchOffset - delta,
      -this.data.mobilePitchLimit,
      this.data.mobilePitchLimit
    );
  },

  calculateDesiredTransform() {
    this.target.object3D.getWorldPosition(
      this.targetWorldPosition
    );

    this.target.object3D.getWorldQuaternion(
      this.targetQuaternion
    );

    this.offset
      .set(
        0,
        this.data.height + this.pitchOffset,
        -this.data.distance
      )
      .applyQuaternion(this.targetQuaternion);

    this.desiredPosition
      .copy(this.targetWorldPosition)
      .add(this.offset);

    this.worldLookTarget.copy(this.targetWorldPosition);
    this.worldLookTarget.y +=
      this.data.lookAtHeight + this.pitchOffset * 0.22;

    const parent = this.el.object3D.parent;

    if (parent) {
      parent.worldToLocal(this.desiredPosition);
      this.localLookTarget.copy(this.worldLookTarget);
      parent.worldToLocal(this.localLookTarget);
    } else {
      this.localLookTarget.copy(this.worldLookTarget);
    }

    this.lookHelper.position.copy(this.desiredPosition);
    this.lookHelper.lookAt(this.localLookTarget);
    this.desiredQuaternion.copy(this.lookHelper.quaternion);
  },

  tick(time, deltaTime) {
    if (!this.target || !deltaTime) {
      return;
    }

    this.calculateDesiredTransform();

    if (!this.hasInitialPosition) {
      this.el.object3D.position.copy(this.desiredPosition);
      this.el.object3D.quaternion.copy(this.desiredQuaternion);
      this.hasInitialPosition = true;
      return;
    }

    const deltaSeconds = Math.min(deltaTime / 1000, 0.05);
    const interpolation =
      1 - Math.exp(-this.data.smoothness * deltaSeconds);

    this.el.object3D.position.lerp(
      this.desiredPosition,
      interpolation
    );

    this.el.object3D.quaternion.slerp(
      this.desiredQuaternion,
      interpolation
    );
  }
});
