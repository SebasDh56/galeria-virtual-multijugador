const nicknameElement =
  document.querySelector("#current-nickname");
const localAvatar = document.querySelector("#local-avatar");
const connectionIndicator =
  document.querySelector(".connection-indicator");
const interactionStatus =
  document.querySelector("#interaction-status");
const scene = document.querySelector("a-scene");
const multiplayerEntity =
  document.querySelector("#remote-players");

const nickname =
  sessionStorage.getItem("galleryNickname");
const avatarType =
  sessionStorage.getItem("galleryAvatarType") || "male";
const clothingColor =
  sessionStorage.getItem("galleryAvatarColor") || "#c8102e";
const clientId =
  sessionStorage.getItem("galleryClientId") ||
  crypto.randomUUID();

sessionStorage.setItem("galleryClientId", clientId);

let interactionStatusTimeout = null;

function showInteractionStatus(event) {
  if (!interactionStatus) {
    return;
  }

  const {
    artworkId,
    errorMessage,
    hasVideo,
    isPlaying
  } = event.detail;
  const action = errorMessage || (hasVideo
    ? isPlaying
      ? "Reproduciendo"
      : "Video pausado"
    : "Obra seleccionada");

  interactionStatus.textContent = `${action}: ${artworkId}`;
  interactionStatus.classList.add(
    "interaction-status--visible"
  );

  window.clearTimeout(interactionStatusTimeout);
  interactionStatusTimeout = window.setTimeout(() => {
    interactionStatus.classList.remove(
      "interaction-status--visible"
    );
  }, 1800);
}

function connectMultiplayer(socket, profile) {
  const connect = () => {
    multiplayerEntity?.components[
      "multiplayer-manager"
    ]?.connect(socket, profile);
  };

  if (scene?.hasLoaded) {
    connect();
    return;
  }

  scene?.addEventListener("loaded", connect, { once: true });
}

function initializeGallery(userNickname) {
  const profile = {
    clientId,
    nickname: userNickname,
    avatarType,
    clothingColor
  };

  if (nicknameElement) {
    nicknameElement.textContent = userNickname;
  }

  localAvatar?.setAttribute("avatar-appearance", profile);
  scene?.addEventListener(
    "artwork-interaction",
    showInteractionStatus
  );

  const socket = io();

  connectMultiplayer(socket, profile);

  socket.on("connect", () => {
    connectionIndicator?.classList.add(
      "connection-indicator--online"
    );
  });

  socket.on("disconnect", () => {
    connectionIndicator?.classList.remove(
      "connection-indicator--online"
    );
  });
}

if (!nickname) {
  window.location.replace("/");
} else {
  initializeGallery(nickname);
}
