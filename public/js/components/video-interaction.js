let galleryVideoInstanceId = 0;

AFRAME.registerComponent("video-interaction", {
  schema: {
    video: { type: "selector" },
    videoSrc: { type: "string", default: "" },
    posterSrc: { type: "string", default: "" },
    pauseOthers: { type: "boolean", default: true },
    restartOnEnded: { type: "boolean", default: true }
  },

  init() {
    this.handleClick = this.handleClick.bind(this);
    this.handleVideoEnded = this.handleVideoEnded.bind(this);

    this.video = null;
    this.createdVideo = null;
    this.highlightTimeout = null;
    this.interactionDetail = {
      artworkId: this.el.dataset.artworkId || "",
      videoId: "",
      isPlaying: false,
      hasVideo: Boolean(this.data.video || this.data.videoSrc)
    };

    this.el.addEventListener("click", this.handleClick);
    this.setVideo(this.data.video);
  },

  update(previousData) {
    if (!this.interactionDetail) {
      return;
    }

    const selectorChanged =
      previousData.video !== this.data.video;
    const sourceChanged =
      previousData.videoSrc !== this.data.videoSrc;

    if (sourceChanged && this.createdVideo) {
      this.removeCreatedVideo();
    }

    if (selectorChanged || sourceChanged) {
      this.setVideo(this.data.video);
    }

    this.updateInteractionDetail();
    if (!this.createdVideo) {
      this.restorePoster();
    }
  },

  setVideo(video) {
    if (this.video === video) {
      return;
    }

    this.video?.removeEventListener(
      "ended",
      this.handleVideoEnded
    );

    this.video = video || null;
    this.video?.addEventListener(
      "ended",
      this.handleVideoEnded
    );

    this.updateInteractionDetail();
  },

  updateInteractionDetail() {
    if (!this.interactionDetail) {
      return;
    }

    this.interactionDetail.videoId = this.video?.id || "";
    this.interactionDetail.hasVideo = Boolean(
      this.video || this.data.videoSrc
    );
  },

  createVideo() {
    if (!this.data.videoSrc) {
      return null;
    }

    galleryVideoInstanceId += 1;

    const video = document.createElement("video");
    const artworkId =
      this.el.dataset.artworkId || "artwork";
    const safeArtworkId = artworkId.replace(
      /[^a-zA-Z0-9_-]/g,
      "-"
    );

    video.id =
      `gallery-video-${safeArtworkId}-${galleryVideoInstanceId}`;
    video.src = this.data.videoSrc;
    video.preload = "metadata";
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const assets = document.querySelector("a-assets");
    (assets || document.body).appendChild(video);

    this.createdVideo = video;
    this.setVideo(video);

    this.el.setAttribute("material", "src", `#${video.id}`);
    this.el.setAttribute("material", "color", "#ffffff");
    this.el.setAttribute("material", "shader", "flat");

    return video;
  },

  restorePoster() {
    if (this.data.posterSrc) {
      this.el.setAttribute("material", {
        src: this.data.posterSrc,
        color: "#ffffff",
        shader: "flat",
        side: "double"
      });
      return;
    }

    this.el.setAttribute("material", {
      color: this.el.dataset.defaultArtworkColor || "#b76b45",
      roughness: 0.82,
      metalness: 0,
      side: "double"
    });
  },

  ensureVideo() {
    return this.video || this.createVideo();
  },

  removeCreatedVideo() {
    if (!this.createdVideo) {
      return;
    }

    const video = this.createdVideo;
    this.createdVideo = null;

    if (this.video === video) {
      this.setVideo(null);
    }

    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
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
    this.updateInteractionDetail();
    this.el.emit(
      "artwork-interaction",
      this.interactionDetail,
      true
    );
  },

  handleClick() {
    this.showSelectionFeedback();

    const video = this.ensureVideo();

    if (!video) {
      this.emitInteraction(false);
      return;
    }

    if (!video.paused) {
      video.pause();
      this.emitInteraction(false);
      return;
    }

    this.pauseOtherVideos();

    const playback = video.play();

    if (playback && typeof playback.catch === "function") {
      playback
        .then(() => this.emitInteraction(true))
        .catch(() => this.emitInteraction(false));
      return;
    }

    this.emitInteraction(true);
  },

  handleVideoEnded() {
    if (this.createdVideo && this.data.posterSrc) {
      this.removeCreatedVideo();
      this.restorePoster();
    } else if (this.data.restartOnEnded) {
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
    this.removeCreatedVideo();
  }
});
