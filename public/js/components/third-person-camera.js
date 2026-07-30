AFRAME.registerComponent("third-person-camera", {
  schema: {
    distance: { type: "number", default: 4.5 },
    height: { type: "number", default: 2.7 },
    smoothness: { type: "number", default: 8 }
  },

  init() {
    this.target = document.querySelector("#local-avatar");

    this.desiredPosition = new THREE.Vector3();
    this.worldTarget = new THREE.Vector3();
  },

  tick(time, deltaTime) {
    if (!this.target || !deltaTime) {
      return;
    }

    const deltaSeconds = Math.min(deltaTime / 1000, 0.05);

    this.target.object3D.getWorldPosition(this.worldTarget);

    const avatarQuaternion =
      this.target.object3D.getWorldQuaternion(
        new THREE.Quaternion()
      );

    const offset = new THREE.Vector3(
      0,
      this.data.height,
      this.data.distance
    );

    offset.applyQuaternion(avatarQuaternion);

    this.desiredPosition
      .copy(this.worldTarget)
      .add(offset);

    const parent = this.el.object3D.parent;

    if (parent) {
      parent.worldToLocal(this.desiredPosition);
    }

    const interpolation =
      1 -
      Math.exp(
        -this.data.smoothness * deltaSeconds
      );

    this.el.object3D.position.lerp(
      this.desiredPosition,
      interpolation
    );

    const localLookTarget =
      this.worldTarget.clone();

    if (parent) {
      parent.worldToLocal(localLookTarget);
    }

    this.el.object3D.lookAt(localLookTarget);
  }
});