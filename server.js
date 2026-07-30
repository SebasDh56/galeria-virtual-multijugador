const path = require("node:path");
const http = require("node:http");

const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Entrega todos los archivos del frontend.
app.use(express.static(path.join(__dirname, "public")));

// Ruta para comprobar el estado del servidor.
app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    application: "Galería Virtual Multijugador",
    timestamp: new Date().toISOString()
  });
});

// Conexión inicial de Socket.IO.
io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("----------------------------------------");
  console.log("Galería Virtual Multijugador");
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
  console.log("----------------------------------------");
});