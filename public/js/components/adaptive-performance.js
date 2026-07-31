AFRAME.registerComponent("adaptive-performance", {
  schema: {
    mobilePixelRatio: { type: "number", default: 1.25 },
    desktopPixelRatio: { type: "number", default: 2 }
  },

  init() {
    this.handleResize = this.applyProfile.bind(this);
    this.applyProfile = this.applyProfile.bind(this);

    window.addEventListener("resize", this.handleResize);
    this.el.addEventListener(
      "renderstart",
      this.applyProfile
    );
    this.el.addEventListener(
      "gallery-built",
      this.applyProfile
    );
  },

  isMobileLayout() {
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 900
    );
  },

  applyProfile() {
    const isMobile = this.isMobileLayout();
    const maximumPixelRatio = isMobile
      ? this.data.mobilePixelRatio
      : this.data.desktopPixelRatio;
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      maximumPixelRatio
    );

    this.el.renderer?.setPixelRatio(pixelRatio);
    this.el.dataset.performanceProfile = isMobile
      ? "mobile"
      : "desktop";
    this.el.dataset.renderPixelRatio = String(pixelRatio);

    const pointLights = document.querySelectorAll(
      ".gallery-point-light"
    );

    pointLights.forEach((light, index) => {
        const isVisible = !isMobile || index % 2 === 0;

        light.setAttribute("visible", isVisible);
        light.object3D.visible = isVisible;
      });

    this.el.dataset.activePointLights = String(
      isMobile
        ? Math.ceil(pointLights.length / 2)
        : pointLights.length
    );
  },

  remove() {
    window.removeEventListener("resize", this.handleResize);
    this.el.removeEventListener(
      "renderstart",
      this.applyProfile
    );
    this.el.removeEventListener(
      "gallery-built",
      this.applyProfile
    );
  }
});
