AFRAME.registerComponent("video-interaction", {
  schema: {
    video: { type: "selector" },
    videoSrc: { type: "string", default: "" },
    posterSrc: { type: "string", default: "" },
    title: { type: "string", default: "" },
    author: { type: "string", default: "" },
    pauseOthers: { type: "boolean", default: true },
    restartOnEnded: { type: "boolean", default: true }
  },

  init() {
    this.handleClick = this.handleClick.bind(this);
    this.el.addEventListener("click", this.handleClick);
  },

  getVideoSource() {
    return (
      this.data.videoSrc ||
      this.data.video?.currentSrc ||
      this.data.video?.src ||
      ""
    );
  },

  showSelectionFeedback() {
    window.clearTimeout(this.highlightTimeout);
    this.el.setAttribute("material", "emissive", "#5b421d");
    this.el.setAttribute(
      "material",
      "emissiveIntensity",
      0.38
    );

    this.highlightTimeout = window.setTimeout(() => {
      this.el.setAttribute("material", "emissive", "#000000");
      this.el.setAttribute(
        "material",
        "emissiveIntensity",
        0
      );
    }, 450);
  },

  handleClick() {
    this.showSelectionFeedback();

    this.el.emit(
      "artwork-viewer-request",
      {
        artworkId: this.el.dataset.artworkId || "",
        title: this.data.title,
        author: this.data.author,
        videoSrc: this.getVideoSource(),
        posterSrc: this.data.posterSrc,
        pauseOthers: this.data.pauseOthers,
        restartOnEnded: this.data.restartOnEnded,
        sourceElement: this.el
      },
      true
    );
  },

  remove() {
    window.clearTimeout(this.highlightTimeout);
    this.el.removeEventListener("click", this.handleClick);
  }
});
