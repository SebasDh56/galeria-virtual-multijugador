# Videos de las obras

Coloca en esta carpeta los archivos de video que se mostrarán en la
galería. Se recomienda usar MP4 con video H.264 y audio AAC por su
compatibilidad con navegadores de escritorio y móviles.

Después, abre `public/js/config/artwork-media.js` y asigna la ruta
pública del archivo a la obra correspondiente. Ejemplo:

```js
"corridor-left-01": "/assets/videos/obra-bienvenida.mp4"
```

Las obras disponibles son:

- `corridor-left-01`
- `corridor-left-02`
- `corridor-right-01`
- `corridor-right-02`
- `front-01`
- `front-02`
- `front-03`
- `front-04`
- `left-wall-01`
- `right-wall-01`
- `interior-left-01`
- `interior-right-01`
- `lobby-feature-01`

Los videos no se descargan al abrir la galería. Cada archivo se crea y
reproduce únicamente cuando el visitante interactúa con su obra.
