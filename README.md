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

## Administración con Supabase

La administración incluye:

- inicio de sesión separado en `/admin/login`;
- panel protegido en `/admin`;
- cierre de sesión;
- un solo administrador autorizado;
- tabla `artworks` con RLS;
- buckets públicos para lectura y restringidos para escritura;
- trece espacios predefinidos, incluidos los muros interiores y una obra destacada en el lobby;
- formulario CRUD para crear, editar, activar y eliminar obras;
- asignación automática y estable de cada obra al primer espacio libre;
- selección de videos MP4 de hasta 45 MB;
- validación local del formato y tamaño antes de iniciar la subida;
- subidas reanudables a Supabase Storage en bloques de 6 MiB;
- generación local de miniaturas WebP;
- carga dinámica y diferida de las obras activas.

### 1. Crear y configurar el proyecto

1. Crear un proyecto en Supabase.
2. Abrir **SQL Editor** en el panel de Supabase.
3. Ejecutar todo el contenido de
   `supabase/migrations/202608030001_create_artworks_admin_security.sql`.
4. Copiar `.env.example` como `.env`.
5. Completar la URL y la publishable key del proyecto:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_reemplazar
```

Los proyectos que todavía utilizan claves legacy pueden configurar
`SUPABASE_ANON_KEY` en lugar de `SUPABASE_PUBLISHABLE_KEY`. Nunca se
debe colocar una `service_role` o secret key en `public/` ni en el
repositorio.

Si el proyecto ya tenía la administración instalada, ejecutar además
`supabase/migrations/202608060001_expand_gallery_media.sql`. Esta
migración agrega las tres ubicaciones nuevas, registra las métricas de
tamaño y fija en 45 MiB el límite final del bucket de videos.
Después, ejecutar
`supabase/migrations/202608060002_auto_assign_artwork_slots.sql` para
numerar las obras existentes y garantizar una posición única por obra.

### 2. Crear el administrador único

1. En Supabase, abrir **Authentication > Users**.
2. Crear manualmente el usuario con correo y contraseña.
3. Confirmar el correo desde el panel si fuera necesario.
4. En **SQL Editor**, autorizar ese usuario sustituyendo el correo:

```sql
insert into private.admin_users (user_id)
select id
from auth.users
where email = 'administrador@ejemplo.com';
```

La restricción `singleton` impide registrar un segundo administrador.
Para cambiar de administrador, primero se debe eliminar la fila actual
de `private.admin_users` y después insertar el nuevo usuario.

### 3. Probar el acceso

```bash
npm run dev
```

1. Abrir `http://localhost:3000/admin/login`.
2. Ingresar con el correo y la contraseña creados en Supabase.
3. Comprobar que `/admin` muestra el correo del administrador.
4. Pulsar **Cerrar sesión** y verificar la redirección.
5. Abrir directamente `/admin` sin sesión y verificar que redirige a
   `/admin/login`.

En Render se deben configurar `SUPABASE_URL` y
`SUPABASE_PUBLISHABLE_KEY` como variables del servicio. El archivo
`render.yaml` ya solicita ambas sin incluir valores reales.

## Controles

### PC

- `WASD` o flechas: movimiento.
- `Shift`: correr.
- `Espacio`: saltar.
- `H`: saludar.
- `V`: cambiar entre primera y tercera persona.
- Mouse: cámara.
- Clic o `E`: abrir la obra visible en primer plano.
- `Esc`: cerrar la obra y volver a la galería.

### Móvil

- Joystick izquierdo: movimiento.
- Arrastrar en el lado derecho: cámara.
- Botones: correr, saltar, saludar, cambiar vista e interactuar.
- El botón `X` cierra la obra abierta.

En pantallas móviles se limita automáticamente la densidad de píxeles
y se reduce el número de luces puntuales activas.

## Optimización multijugador

- El movimiento se envía a 10 Hz únicamente cuando supera los umbrales
  de posición o rotación.
- Un jugador detenido envía solamente un latido cada dos segundos.
- Lobby, pasillo y sala principal usan zonas de interés de Socket.IO.
- Cada sala mantiene visible su zona vecina completa para conservar
  vistas naturales entre puertas y pasillos.
- Los avatares cercanos mantienen animaciones, nombres y sombras.
- Los avatares lejanos desactivan progresivamente nombres, sombras y
  animación; solo fuera de 40 metros se ocultan.
- El contador de usuarios continúa siendo global.

Las verificaciones unitarias y multijugador se ejecutan con:

```bash
npm run check
```

## Videos de las obras

La forma principal de publicar una obra es ingresar en `/admin` y
seleccionar un MP4 de hasta 45 MB. La aplicación lo asigna al primer
espacio libre como `Obra 1` hasta `Obra 13`, sin pedir una ubicación.
El navegador valida el archivo, genera una miniatura WebP y lo envía
directamente a Supabase Storage sin pasar por Render.

Los archivos mayores deben comprimirse previamente con
[HandBrake](https://handbrake.fr/downloads.php), una
aplicación gratuita y open source para Windows, macOS y Linux. Se
recomienda el preset `General > Fast 720p30`, formato MP4, video H.264,
audio AAC y la opción `Web Optimised`. Antes de subirlo, confirma que el
resultado final pese 45 MB o menos.

Como alternativa local sin Supabase:

1. Copiar cada video a `public/assets/videos`.
2. Abrir `public/js/config/artwork-media.js`.
3. Asignar la ruta del video al identificador de la obra:

```js
"front-01": "/assets/videos/mi-obra.mp4"
```

La galería sirve automáticamente esa carpeta mediante Express. Los
videos usan carga diferida: no se descargan hasta que el visitante
interactúa con la obra. Un solo visor de video se reutiliza para todas
las ubicaciones y libera el archivo al cerrarse. Para reducir el tiempo
de carga, se recomienda usar archivos MP4 H.264 comprimidos y nombres
sin espacios ni tildes.

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
- `public/js/components/artwork-viewer.js`: visor accesible y
  reutilizable para videos e imágenes en primer plano.
- `public/js/admin`: controladores de las pantallas administrativas.
- `public/js/services`: cliente y autenticación de Supabase.
- `public/js/config/gallery-slots.js`: trece ubicaciones usadas por las
  obras dinámicas.
- `public/assets`: recursos visuales optimizados.
- `supabase/migrations`: esquema, RLS y políticas de Storage.
- `views`: HTML administrativo que no se expone mediante archivos
  estáticos.
- `server`: entorno, rutas administrativas y zonas multijugador.
- `server.js`: servidor Express y sincronización Socket.IO.
- `render.yaml`: infraestructura gratuita de Render.

## Licencia

Distribuido bajo la licencia MIT.
