# Galería Virtual Multijugador

Galería universitaria 3D construida con HTML, CSS, JavaScript ES6,
A-Frame, Three.js, Node.js, Express y Socket.IO.

## Ejecución local

Requisitos:

- Node.js 20, 21 o 22.
- npm.

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

## Controles

### PC

- `WASD` o flechas: movimiento.
- `Shift`: correr.
- `Espacio`: saltar.
- `H`: saludar.
- `V`: cambiar entre primera y tercera persona.
- Mouse y clic: cámara e interacción.

### Móvil

- Joystick izquierdo: movimiento.
- Arrastrar en el lado derecho: cámara.
- Botones: correr, saltar, saludar, cambiar vista e interactuar.

En pantallas móviles se limita automáticamente la densidad de píxeles
y se reduce el número de luces puntuales activas.

## Despliegue gratuito en Render

El archivo `render.yaml` configura un Web Service gratuito compatible
con Express y WebSockets.

1. Publicar este repositorio en GitHub.
2. Crear una cuenta gratuita en [Render](https://render.com/).
3. Elegir **New > Blueprint**.
4. Conectar el repositorio.
5. Confirmar el servicio definido en `render.yaml`.

Render ejecutará `npm ci --omit=dev`, iniciará la aplicación con
`npm start` y comprobará `/api/health`.

La instancia gratuita puede detenerse después de 15 minutos sin
tráfico. El primer acceso posterior puede tardar cerca de un minuto.
La presencia multijugador se conserva únicamente mientras el proceso
está activo, porque actualmente no se necesita una base de datos.

## Arquitectura

- `public/js/components`: componentes A-Frame con responsabilidades
  separadas.
- `public/assets`: recursos visuales optimizados.
- `server.js`: servidor Express y sincronización Socket.IO.
- `render.yaml`: infraestructura gratuita de Render.

## Licencia

Distribuido bajo la licencia MIT.
