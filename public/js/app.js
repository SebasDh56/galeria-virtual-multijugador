const nicknameElement = document.querySelector("#current-nickname");

const nickname = sessionStorage.getItem("galleryNickname");

if (!nickname) {
  window.location.replace("/");
} else {
  nicknameElement.textContent = nickname;
}

const socket = io();

socket.on("connect", () => {
  console.log("Conectado al servidor Socket.IO");
  console.log("Socket ID:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Conexión Socket.IO finalizada");
});