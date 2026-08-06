AFRAME.registerComponent("multiplayer-manager", {
  schema: {
    localRig: { type: "selector" },
    localAvatar: { type: "selector" },
    sendRate: { type: "number", default: 10 },
    idleSendRate: { type: "number", default: 0.5 },
    positionThreshold: { type: "number", default: 0.025 },
    rotationThreshold: { type: "number", default: 1.5 },
    interpolation: { type: "number", default: 10 },
    nearLodDistance: { type: "number", default: 11 },
    farLodDistance: { type: "number", default: 20 },
    cullDistance: { type: "number", default: 24 },
    lodInterval: { type: "number", default: 250 }
  },

  init() {
    this.socket = null;
    this.profile = null;
    this.remotePlayers = new Map();
    this.lastSentAt = 0;
    this.lastLodUpdateAt = 0;
    this.hasSentMotion = false;
    this.lastSentPosition = new THREE.Vector3();
    this.lastSentRotation = 0;
    this.lastSentMotion = {
      isMoving: false,
      isSprinting: false,
      isJumping: false
    };
    this.up = new THREE.Vector3(0, 1, 0);
    this.onlineCount =
      document.querySelector("#online-players-count");

    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleSnapshot = this.handleSnapshot.bind(this);
    this.handlePlayerSpawn = this.handlePlayerSpawn.bind(this);
    this.handlePlayerJoined = this.handlePlayerJoined.bind(this);
    this.handlePlayerMoved = this.handlePlayerMoved.bind(this);
    this.handlePlayerAction = this.handlePlayerAction.bind(this);
    this.handlePlayerLeft = this.handlePlayerLeft.bind(this);
    this.handlePlayersCount = this.handlePlayersCount.bind(this);
    this.handleLocalMotion = this.handleLocalMotion.bind(this);
    this.handleLocalAction = this.handleLocalAction.bind(this);
    this.interpolateRemotePlayer =
      this.interpolateRemotePlayer.bind(this);
  },

  connect(socket, profile) {
    if (!socket) {
      return;
    }

    this.disconnectSocket();
    this.socket = socket;
    this.profile = profile;

    socket.on("connect", this.handleConnect);
    socket.on("disconnect", this.handleDisconnect);
    socket.on("players:snapshot", this.handleSnapshot);
    socket.on("player:spawn", this.handlePlayerSpawn);
    socket.on("player:joined", this.handlePlayerJoined);
    socket.on("player:moved", this.handlePlayerMoved);
    socket.on("player:action", this.handlePlayerAction);
    socket.on("player:left", this.handlePlayerLeft);
    socket.on("players:count", this.handlePlayersCount);

    this.data.localRig?.addEventListener(
      "player-motion",
      this.handleLocalMotion
    );
    this.data.localRig?.addEventListener(
      "player-action",
      this.handleLocalAction
    );

    if (socket.connected) {
      this.handleConnect();
    }
  },

  disconnectSocket() {
    if (!this.socket) {
      return;
    }

    this.socket.off("connect", this.handleConnect);
    this.socket.off("disconnect", this.handleDisconnect);
    this.socket.off("players:snapshot", this.handleSnapshot);
    this.socket.off("player:spawn", this.handlePlayerSpawn);
    this.socket.off("player:joined", this.handlePlayerJoined);
    this.socket.off("player:moved", this.handlePlayerMoved);
    this.socket.off("player:action", this.handlePlayerAction);
    this.socket.off("player:left", this.handlePlayerLeft);
    this.socket.off("players:count", this.handlePlayersCount);
    this.data.localRig?.removeEventListener(
      "player-motion",
      this.handleLocalMotion
    );
    this.data.localRig?.removeEventListener(
      "player-action",
      this.handleLocalAction
    );
  },

  getLocalState() {
    const rigPosition = this.data.localRig?.object3D.position;
    const avatarRotation =
      this.data.localAvatar?.object3D.rotation.y || 0;

    return {
      position: {
        x: rigPosition?.x || 0,
        y: rigPosition?.y || 0.12,
        z: rigPosition?.z || 16
      },
      rotationY: avatarRotation
    };
  },

  handleConnect() {
    if (!this.profile) {
      return;
    }

    this.socket.emit("player:join", {
      ...this.profile,
      ...this.getLocalState()
    });
  },

  handleDisconnect() {
    this.clearRemotePlayers();
    this.updateOnlineCount(1);
  },

  handleSnapshot(players) {
    const visiblePlayerIds = new Set();

    if (Array.isArray(players)) {
      players.forEach((player) => {
        visiblePlayerIds.add(player.id);
        this.upsertPlayer(player, true);
      });
    }

    this.remotePlayers.forEach((player, playerId) => {
      if (!visiblePlayerIds.has(playerId)) {
        player.el.remove();
        this.remotePlayers.delete(playerId);
      }
    });
  },

  handlePlayerSpawn(state) {
    const position = state?.position;

    if (!position || !this.data.localRig) {
      return;
    }

    this.data.localRig.object3D.position.set(
      position.x,
      position.y,
      position.z
    );

    if (this.data.localAvatar) {
      this.data.localAvatar.object3D.rotation.y =
        state.rotationY || 0;
    }
  },

  handlePlayerJoined(player) {
    this.upsertPlayer(player, true);
  },

  handlePlayerMoved(player) {
    const remotePlayer = this.upsertPlayer(player, false);

    if (!remotePlayer) {
      return;
    }

    remotePlayer.motionDetail.speed = player.speed || 0;
    remotePlayer.motionDetail.isMoving =
      remotePlayer.motionDetail.speed > 0.1;
    remotePlayer.motionDetail.isSprinting =
      Boolean(player.isSprinting);
    remotePlayer.motionDetail.isJumping =
      Boolean(player.isJumping);
    remotePlayer.el.emit(
      "player-motion",
      remotePlayer.motionDetail
    );
  },

  handlePlayerAction(player) {
    const remotePlayer = this.remotePlayers.get(player?.id);

    if (!remotePlayer || player.action !== "wave") {
      return;
    }

    remotePlayer.el.emit("player-action", {
      action: "wave"
    });
  },

  handlePlayerLeft(playerId) {
    const remotePlayer = this.remotePlayers.get(playerId);

    if (!remotePlayer) {
      return;
    }

    remotePlayer.el.remove();
    this.remotePlayers.delete(playerId);
  },

  handlePlayersCount(count) {
    this.updateOnlineCount(count);
  },

  handleLocalMotion(event) {
    if (!this.socket?.connected) {
      return;
    }

    const detail = event.detail;
    const position = this.data.localRig.object3D.position;
    const rotationY =
      this.data.localAvatar?.object3D.rotation.y || 0;
    const now = performance.now();
    const isMoving = detail.speed > 0.1;
    const stateChanged =
      !this.hasSentMotion ||
      isMoving !== this.lastSentMotion.isMoving ||
      Boolean(detail.isSprinting) !==
        this.lastSentMotion.isSprinting ||
      Boolean(detail.isJumping) !==
        this.lastSentMotion.isJumping;
    const positionChanged =
      !this.hasSentMotion ||
      position.distanceToSquared(this.lastSentPosition) >=
        this.data.positionThreshold *
          this.data.positionThreshold;
    const rotationDelta = Math.abs(
      Math.atan2(
        Math.sin(rotationY - this.lastSentRotation),
        Math.cos(rotationY - this.lastSentRotation)
      )
    );
    const rotationChanged =
      !this.hasSentMotion ||
      rotationDelta >=
        THREE.MathUtils.degToRad(this.data.rotationThreshold);
    const fastUpdateDue =
      now - this.lastSentAt >= 1000 / this.data.sendRate;
    const idleUpdateDue =
      now - this.lastSentAt >= 1000 / this.data.idleSendRate;

    if (!stateChanged) {
      if (isMoving || positionChanged || rotationChanged) {
        if (
          !fastUpdateDue ||
          (!positionChanged && !rotationChanged)
        ) {
          return;
        }
      } else if (!idleUpdateDue) {
        return;
      }
    }

    this.lastSentAt = now;
    this.hasSentMotion = true;
    this.lastSentPosition.copy(position);
    this.lastSentRotation = rotationY;
    this.lastSentMotion.isMoving = isMoving;
    this.lastSentMotion.isSprinting = Boolean(
      detail.isSprinting
    );
    this.lastSentMotion.isJumping = Boolean(detail.isJumping);

    this.socket.volatile.emit("player:move", {
      position: {
        x: Number(position.x.toFixed(3)),
        y: Number(position.y.toFixed(3)),
        z: Number(position.z.toFixed(3))
      },
      rotationY: Number(rotationY.toFixed(4)),
      speed: Number(detail.speed.toFixed(2)),
      isSprinting: detail.isSprinting,
      isJumping: detail.isJumping
    });
  },

  handleLocalAction(event) {
    if (
      this.socket?.connected &&
      event.detail?.action === "wave"
    ) {
      this.socket.emit("player:action", {
        action: "wave"
      });
    }
  },

  createRemoteAvatar(player) {
    const sourceAvatar = this.data.localAvatar;

    if (!sourceAvatar) {
      return null;
    }

    const remoteAvatar = sourceAvatar.cloneNode(true);

    remoteAvatar.removeAttribute("id");
    remoteAvatar.querySelectorAll("[id]").forEach((element) => {
      element.removeAttribute("id");
    });
    remoteAvatar.classList.add("remote-avatar");
    remoteAvatar.dataset.remoteAvatar = player.id;
    remoteAvatar.setAttribute("visible", true);
    remoteAvatar.setAttribute("scale", "1.03 1.03 1.03");
    remoteAvatar.setAttribute("avatar-appearance", {
      avatarType: player.avatarType,
      clothingColor: player.clothingColor,
      nickname: player.nickname
    });

    this.el.appendChild(remoteAvatar);

    const position = player.position || {};
    remoteAvatar.object3D.position.set(
      position.x || 0,
      position.y || 0.12,
      position.z || 16
    );
    remoteAvatar.object3D.quaternion.setFromAxisAngle(
      this.up,
      player.rotationY || 0
    );
    remoteAvatar.object3D.visible = true;

    return {
      el: remoteAvatar,
      targetPosition: remoteAvatar.object3D.position.clone(),
      targetQuaternion: remoteAvatar.object3D.quaternion.clone(),
      motionDetail: {
        speed: 0,
        isMoving: false,
        isSprinting: false,
        isJumping: false
      },
      lodLevel: "",
      nameLabel: remoteAvatar.querySelector(".avatar-name"),
      shadowParts: Array.from(
        remoteAvatar.querySelectorAll("[shadow]")
      ).map((element) => ({
        element,
        shadow: element.getAttribute("shadow")
      }))
    };
  },

  setRemoteLod(player, lodLevel) {
    if (player.lodLevel === lodLevel) {
      return;
    }

    player.lodLevel = lodLevel;
    const isHidden = lodLevel === "hidden";
    const isNear = lodLevel === "near";
    const shouldAnimate =
      lodLevel === "near" || lodLevel === "medium";

    player.el.object3D.visible = !isHidden;
    player.nameLabel?.setAttribute("visible", isNear);
    player.el.setAttribute(
      "avatar-animator",
      "enabled",
      shouldAnimate
    );

    player.shadowParts.forEach(({ element, shadow }) => {
      element.setAttribute("shadow", {
        cast: isNear && Boolean(shadow?.cast),
        receive: isNear && Boolean(shadow?.receive)
      });
    });
  },

  updateRemoteLod(time) {
    if (
      time - this.lastLodUpdateAt < this.data.lodInterval ||
      !this.data.localRig
    ) {
      return;
    }

    this.lastLodUpdateAt = time;
    const localPosition = this.data.localRig.object3D.position;
    const nearDistanceSquared =
      this.data.nearLodDistance * this.data.nearLodDistance;
    const farDistanceSquared =
      this.data.farLodDistance * this.data.farLodDistance;
    const cullDistanceSquared =
      this.data.cullDistance * this.data.cullDistance;

    this.remotePlayers.forEach((player) => {
      const distanceSquared =
        localPosition.distanceToSquared(
          player.el.object3D.position
        );
      let lodLevel = "near";

      if (distanceSquared > cullDistanceSquared) {
        lodLevel = "hidden";
      } else if (distanceSquared > farDistanceSquared) {
        lodLevel = "far";
      } else if (distanceSquared > nearDistanceSquared) {
        lodLevel = "medium";
      }

      this.setRemoteLod(player, lodLevel);
    });
  },

  upsertPlayer(player, snapToPosition) {
    if (!player?.id || player.id === this.socket?.id) {
      return null;
    }

    let remotePlayer = this.remotePlayers.get(player.id);

    if (!remotePlayer) {
      remotePlayer = this.createRemoteAvatar(player);

      if (!remotePlayer) {
        return null;
      }

      this.remotePlayers.set(player.id, remotePlayer);
    }

    const position = player.position || {};

    remotePlayer.targetPosition.set(
      position.x ?? remotePlayer.targetPosition.x,
      position.y ?? remotePlayer.targetPosition.y,
      position.z ?? remotePlayer.targetPosition.z
    );
    remotePlayer.targetQuaternion.setFromAxisAngle(
      this.up,
      player.rotationY ?? 0
    );

    if (snapToPosition) {
      remotePlayer.el.object3D.position.copy(
        remotePlayer.targetPosition
      );
      remotePlayer.el.object3D.quaternion.copy(
        remotePlayer.targetQuaternion
      );
    }

    return remotePlayer;
  },

  updateOnlineCount(count) {
    if (this.onlineCount) {
      this.onlineCount.textContent = String(
        Math.max(1, Number(count) || 1)
      );
    }
  },

  clearRemotePlayers() {
    this.remotePlayers.forEach((player) => player.el.remove());
    this.remotePlayers.clear();
  },

  interpolateRemotePlayer(player) {
    player.el.object3D.position.lerp(
      player.targetPosition,
      this.frameInterpolation
    );
    player.el.object3D.quaternion.slerp(
      player.targetQuaternion,
      this.frameInterpolation
    );
  },

  tick(time, deltaTime) {
    if (!deltaTime || this.remotePlayers.size === 0) {
      return;
    }

    const deltaSeconds = Math.min(deltaTime / 1000, 0.05);
    this.frameInterpolation =
      1 - Math.exp(-this.data.interpolation * deltaSeconds);

    this.remotePlayers.forEach(this.interpolateRemotePlayer);
    this.updateRemoteLod(time);
  },

  remove() {
    this.disconnectSocket();
    this.clearRemotePlayers();
  }
});
