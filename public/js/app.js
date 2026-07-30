const nicknameElement =
  document.querySelector("#current-nickname");

const avatarNameElement =
  document.querySelector("#local-avatar-name");

const connectionIndicator =
  document.querySelector(".connection-indicator");

const nickname =
  sessionStorage.getItem("galleryNickname");

if (!nickname) {
  window.location.replace("/");
} else {
  nicknameElement.textContent = nickname;

  avatarNameElement.setAttribute(
    "value",
    nickname
  );
}

const socket = io();

socket.on("connect", () => {
  console.log("Conectado al servidor Socket.IO");
  console.log("Socket ID:", socket.id);

  connectionIndicator?.classList.add(
    "connection-indicator--online"
  );

  socket.emit("player:join", {
    nickname
  });
});

socket.on("disconnect", () => {
  console.log("Conexión Socket.IO finalizada");

  connectionIndicator?.classList.remove(
    "connection-indicator--online"
  );
});