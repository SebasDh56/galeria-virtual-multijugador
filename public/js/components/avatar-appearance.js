(() => {
  const AVATAR_TYPES = new Set(["male", "female"]);

  AFRAME.registerComponent("avatar-appearance", {
    schema: {
      avatarType: { type: "string", default: "male" },
      clothingColor: { type: "color", default: "#c8102e" },
      nickname: { type: "string", default: "Visitante" }
    },

    init() {
      this.cacheElements();
    },

    cacheElements() {
      this.clothingParts = this.el.querySelectorAll(
        "[data-clothing-part]"
      );
      this.variantParts = this.el.querySelectorAll(
        "[data-avatar-variant]"
      );
      this.torso = this.el.querySelector(".avatar-torso");
      this.leftArm = this.el.querySelector(".avatar-left-arm");
      this.rightArm = this.el.querySelector(".avatar-right-arm");
      this.leftLeg = this.el.querySelector(".avatar-left-leg");
      this.rightLeg = this.el.querySelector(".avatar-right-leg");
      this.nameLabel = this.el.querySelector(".avatar-name");
    },

    getAvatarType() {
      return AVATAR_TYPES.has(this.data.avatarType)
        ? this.data.avatarType
        : "male";
    },

    applyClothingColor() {
      this.clothingParts.forEach((part) => {
        part.setAttribute(
          "material",
          "color",
          this.data.clothingColor
        );
      });
    },

    applyVariant(avatarType) {
      this.variantParts.forEach((part) => {
        const isVisible =
          part.dataset.avatarVariant === avatarType;

        part.setAttribute(
          "visible",
          isVisible ? "true" : "false"
        );
        part.object3D.visible = isVisible;
      });

      const isFemale = avatarType === "female";

      this.torso?.setAttribute(
        "geometry",
        "radius",
        isFemale ? 0.25 : 0.28
      );
      this.torso?.setAttribute(
        "geometry",
        "height",
        isFemale ? 0.76 : 0.82
      );
      this.torso?.setAttribute(
        "position",
        isFemale ? "0 1.29 0" : "0 1.25 0"
      );
      this.leftArm?.setAttribute(
        "position",
        isFemale ? "-0.36 1.55 0" : "-0.39 1.55 0"
      );
      this.rightArm?.setAttribute(
        "position",
        isFemale ? "0.36 1.55 0" : "0.39 1.55 0"
      );
      this.leftLeg?.setAttribute(
        "position",
        isFemale ? "-0.125 0.88 0" : "-0.14 0.88 0"
      );
      this.rightLeg?.setAttribute(
        "position",
        isFemale ? "0.125 0.88 0" : "0.14 0.88 0"
      );
    },

    update() {
      const avatarType = this.getAvatarType();

      this.el.dataset.avatarType = avatarType;
      this.applyClothingColor();
      this.applyVariant(avatarType);
      this.nameLabel?.setAttribute(
        "value",
        this.data.nickname || "Visitante"
      );
    }
  });
})();
