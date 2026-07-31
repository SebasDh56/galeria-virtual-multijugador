AFRAME.registerComponent("third-person-camera", {
  schema: {
    target: { type: "selector" },
    distance: { type: "number", default: 4.5 },
    height: { type: "number", default: 2.7 },
    smoothness: { type: "number", default: 8 },
    lookAtHeight: { type: "number", default: 1.35 },
    mobilePitchLimit: { type: "number", default: 1.1 },
    constrainToGallery: { type: "boolean", default: true },
    boundaryMargin: { type: "number", default: 0.14 }
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
    this.walkableZones = [];

    this.cacheWalkableZones =
      this.cacheWalkableZones.bind(this);

    this.el.sceneEl.addEventListener(
      "gallery-built",
      this.cacheWalkableZones
    );

    this.cacheWalkableZones();
  },

  update(previousData) {
    this.target =
      this.data.target ||
      document.querySelector("#local-avatar");

    if (
      previousData.boundaryMargin !==
      this.data.boundaryMargin
    ) {
      this.cacheWalkableZones();
    }
  },

  addPitchInput(delta) {
    this.pitchOffset = THREE.MathUtils.clamp(
      this.pitchOffset - delta,
      -this.data.mobilePitchLimit,
      this.data.mobilePitchLimit
    );
  },

  cacheWalkableZones() {
    const margin = Math.max(this.data.boundaryMargin, 0);

    this.walkableZones = Array.from(
      document.querySelectorAll(".gallery-walkable-zone")
    )
      .map((zone) => ({
        minX: Number(zone.dataset.minX) + margin,
        maxX: Number(zone.dataset.maxX) - margin,
        minZ: Number(zone.dataset.minZ) + margin,
        maxZ: Number(zone.dataset.maxZ) - margin
      }))
      .filter(
        (zone) =>
          Number.isFinite(zone.minX) &&
          Number.isFinite(zone.maxX) &&
          Number.isFinite(zone.minZ) &&
          Number.isFinite(zone.maxZ) &&
          zone.minX <= zone.maxX &&
          zone.minZ <= zone.maxZ
      );
  },

  constrainDesiredPosition() {
    if (
      !this.data.constrainToGallery ||
      this.walkableZones.length === 0
    ) {
      return;
    }

    const position = this.desiredPosition;

    for (let index = 0; index < this.walkableZones.length; index += 1) {
      const zone = this.walkableZones[index];

      if (
        position.x >= zone.minX &&
        position.x <= zone.maxX &&
        position.z >= zone.minZ &&
        position.z <= zone.maxZ
      ) {
        return;
      }
    }

    let nearestX = position.x;
    let nearestZ = position.z;
    let nearestDistanceSquared = Infinity;

    for (let index = 0; index < this.walkableZones.length; index += 1) {
      const zone = this.walkableZones[index];
      const candidateX = THREE.MathUtils.clamp(
        position.x,
        zone.minX,
        zone.maxX
      );
      const candidateZ = THREE.MathUtils.clamp(
        position.z,
        zone.minZ,
        zone.maxZ
      );
      const differenceX = position.x - candidateX;
      const differenceZ = position.z - candidateZ;
      const distanceSquared =
        differenceX * differenceX +
        differenceZ * differenceZ;

      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearestX = candidateX;
        nearestZ = candidateZ;
      }
    }

    position.x = nearestX;
    position.z = nearestZ;
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

    this.constrainDesiredPosition();

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
  },

  remove() {
    this.el.sceneEl.removeEventListener(
      "gallery-built",
      this.cacheWalkableZones
    );
  }
});
