AFRAME.registerComponent("video-interaction", {
  schema: {
    video: { type: "selector" },
    pauseOthers: { type: "boolean", default: true },
    restartOnEnded: { type: "boolean", default: true }
  },

  init() {
    this.video = this.data.video;
    this.highlightTimeout = null;
    this.interactionDetail = {
      artworkId: this.el.dataset.artworkId || "",
      videoId: this.video?.id || "",
      isPlaying: false,
      hasVideo: Boolean(this.video)
    };

    this.handleClick = this.handleClick.bind(this);
    this.handleVideoEnded = this.handleVideoEnded.bind(this);

    this.el.addEventListener("click", this.handleClick);
    this.video?.addEventListener("ended", this.handleVideoEnded);
  },

  update(previousData) {
    if (previousData.video === this.data.video) {
      return;
    }

    previousData.video?.removeEventListener(
      "ended",
      this.handleVideoEnded
    );

    this.video = this.data.video;
    this.video?.addEventListener(
      "ended",
      this.handleVideoEnded
    );

    if (this.interactionDetail) {
      this.interactionDetail.videoId = this.video?.id || "";
      this.interactionDetail.hasVideo = Boolean(this.video);
    }
  },

  pauseOtherVideos() {
    if (!this.data.pauseOthers) {
      return;
    }

    document.querySelectorAll("video").forEach((video) => {
      if (video !== this.video && !video.paused) {
        video.pause();
      }
    });
  },

  showSelectionFeedback() {
    window.clearTimeout(this.highlightTimeout);

    this.el.setAttribute("material", "emissive", "#5b421d");
    this.el.setAttribute("material", "emissiveIntensity", 0.38);

    this.highlightTimeout = window.setTimeout(() => {
      this.el.setAttribute("material", "emissive", "#000000");
      this.el.setAttribute("material", "emissiveIntensity", 0);
    }, 450);
  },

  emitInteraction(isPlaying) {
    this.interactionDetail.isPlaying = isPlaying;
    this.interactionDetail.hasVideo = Boolean(this.video);
    this.el.emit(
      "artwork-interaction",
      this.interactionDetail,
      true
    );
  },

  handleClick() {
    this.showSelectionFeedback();

    if (!this.video) {
      this.emitInteraction(false);
      return;
    }

    if (!this.video.paused) {
      this.video.pause();
      this.emitInteraction(false);
      return;
    }

    this.pauseOtherVideos();

    const playback = this.video.play();

    if (playback && typeof playback.catch === "function") {
      playback
        .then(() => this.emitInteraction(true))
        .catch(() => this.emitInteraction(false));
      return;
    }

    this.emitInteraction(true);
  },

  handleVideoEnded() {
    if (this.data.restartOnEnded) {
      this.video.currentTime = 0;
    }

    this.emitInteraction(false);
  },

  remove() {
    window.clearTimeout(this.highlightTimeout);
    this.el.removeEventListener("click", this.handleClick);
    this.video?.removeEventListener(
      "ended",
      this.handleVideoEnded
    );
  }
});
