AFRAME.registerComponent("artwork-viewer", {
  schema: {
    viewer: { type: "selector" },
    video: { type: "selector" },
    image: { type: "selector" },
    title: { type: "selector" },
    author: { type: "selector" },
    message: { type: "selector" },
    closeButton: { type: "selector" }
  },

  init() {
    this.viewer =
      this.data.viewer || document.querySelector("#artwork-viewer");
    this.video =
      this.data.video || document.querySelector("#artwork-viewer-video");
    this.image =
      this.data.image || document.querySelector("#artwork-viewer-image");
    this.title =
      this.data.title || document.querySelector("#artwork-viewer-title");
    this.author =
      this.data.author || document.querySelector("#artwork-viewer-author");
    this.message =
      this.data.message || document.querySelector("#artwork-viewer-message");
    this.closeButton =
      this.data.closeButton || document.querySelector("#artwork-viewer-close");

    this.activeArtwork = null;
    this.isOpen = false;

    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleBackdropClick =
      this.handleBackdropClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleVideoEnded =
      this.handleVideoEnded.bind(this);

    this.el.addEventListener(
      "artwork-viewer-request",
      this.handleOpen
    );
    this.viewer?.addEventListener(
      "click",
      this.handleBackdropClick
    );
    this.closeButton?.addEventListener(
      "click",
      this.handleClose
    );
    this.video?.addEventListener(
      "ended",
      this.handleVideoEnded
    );
    window.addEventListener("keydown", this.handleKeyDown);
  },

  setText(element, value) {
    if (!element) {
      return;
    }

    element.textContent = value || "";
    element.hidden = !value;
  },

  setMessage(message = "") {
    if (!this.message) {
      return;
    }

    this.message.textContent = message;
    this.message.hidden = !message;
  },

  pauseOtherVideos() {
    if (!this.activeArtwork?.pauseOthers) {
      return;
    }

    document.querySelectorAll("video").forEach((video) => {
      if (video !== this.video && !video.paused) {
        video.pause();
      }
    });
  },

  emitInteraction(isPlaying, errorMessage = "") {
    const artwork = this.activeArtwork;

    artwork?.sourceElement?.emit(
      "artwork-interaction",
      {
        artworkId: artwork.artworkId,
        videoId: this.video?.id || "",
        hasVideo: Boolean(artwork.videoSrc),
        isPlaying,
        errorMessage
      },
      true
    );
  },

  prepareVideo(videoSrc, posterSrc) {
    if (!this.video) {
      return;
    }

    this.video.hidden = !videoSrc;
    this.video.poster = posterSrc || "";

    if (videoSrc) {
      this.video.src = videoSrc;
      this.video.load();
    }
  },

  prepareImage(videoSrc, posterSrc) {
    if (!this.image) {
      return;
    }

    const showImage = !videoSrc && Boolean(posterSrc);
    this.image.hidden = !showImage;

    if (showImage) {
      this.image.src = posterSrc;
      this.image.alt = this.activeArtwork?.title || "Obra de arte";
    } else {
      this.image.removeAttribute("src");
    }
  },

  async playVideo() {
    if (!this.activeArtwork?.videoSrc || !this.video) {
      return;
    }

    try {
      await this.video.play();
      this.emitInteraction(true);
    } catch (error) {
      this.setMessage(
        "Pulsa reproducir para iniciar el video."
      );
      this.emitInteraction(
        false,
        "Pulsa reproducir para iniciar el video"
      );
    }
  },

  handleOpen(event) {
    if (!this.viewer) {
      return;
    }

    if (this.isOpen) {
      this.releaseMedia();
    }

    this.activeArtwork = event.detail;
    const { author, posterSrc, title, videoSrc } =
      this.activeArtwork;

    this.setText(
      this.title,
      title || `Obra ${this.activeArtwork.artworkId}`
    );
    this.setText(this.author, author);
    this.setMessage(
      videoSrc || posterSrc
        ? ""
        : "Esta obra todavía no tiene contenido disponible."
    );
    this.prepareVideo(videoSrc, posterSrc);
    this.prepareImage(videoSrc, posterSrc);
    this.pauseOtherVideos();

    this.isOpen = true;
    this.viewer.hidden = false;
    this.viewer.setAttribute("aria-hidden", "false");
    document.body.classList.add("artwork-viewer-open");

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    this.el.emit(
      "artwork-viewer-opened",
      { artworkId: this.activeArtwork.artworkId }
    );
    this.closeButton?.focus({ preventScroll: true });
    void this.playVideo();
  },

  releaseMedia() {
    if (!this.video) {
      return;
    }

    this.video.pause();
    this.video.removeAttribute("src");
    this.video.poster = "";
    this.video.load();
  },

  handleClose() {
    if (!this.isOpen) {
      return;
    }

    const artworkId = this.activeArtwork?.artworkId || "";

    this.releaseMedia();
    this.image?.removeAttribute("src");
    this.viewer.hidden = true;
    this.viewer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("artwork-viewer-open");
    this.isOpen = false;
    this.activeArtwork = null;

    this.el.emit("artwork-viewer-closed", { artworkId });
  },

  handleBackdropClick(event) {
    if (event.target === this.viewer) {
      this.handleClose();
    }
  },

  handleKeyDown(event) {
    if (event.code === "Escape" && this.isOpen) {
      event.preventDefault();
      this.handleClose();
    }
  },

  handleVideoEnded() {
    if (
      this.activeArtwork?.restartOnEnded &&
      this.video
    ) {
      this.video.currentTime = 0;
    }

    this.emitInteraction(false);
  },

  remove() {
    this.handleClose();
    this.el.removeEventListener(
      "artwork-viewer-request",
      this.handleOpen
    );
    this.viewer?.removeEventListener(
      "click",
      this.handleBackdropClick
    );
    this.closeButton?.removeEventListener(
      "click",
      this.handleClose
    );
    this.video?.removeEventListener(
      "ended",
      this.handleVideoEnded
    );
    window.removeEventListener("keydown", this.handleKeyDown);
  }
});
