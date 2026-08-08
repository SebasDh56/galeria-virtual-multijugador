const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function readPublicFile(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, "../public", relativePath),
    "utf8"
  );
}

function loadVideoOptimizer() {
  const source = `${readPublicFile("js/admin/video-optimizer.js")
    .replaceAll("export ", "")}
    globalThis.__result = {
      VIDEO_LIMITS,
      calculateSavings,
      formatFileSize,
      optimizeVideo,
      validateSourceVideo
    };`;
  const context = {};
  vm.runInNewContext(source, context);
  return context.__result;
}

function loadGallerySlots() {
  const source = `${readPublicFile("js/config/gallery-slots.js")
    .replaceAll("export ", "")}
    globalThis.__result = GALLERY_SLOTS;`;
  const context = {};
  vm.runInNewContext(source, context);
  return Array.from(context.__result);
}

function loadUploadConfiguration() {
  const source = `${readPublicFile("js/services/storage-service.js")
    .replace(/import[\s\S]*?;\s*/, "")
    .replaceAll("export ", "")}
    globalThis.__result = UPLOAD_CONFIGURATION;`;
  const context = {};
  vm.runInNewContext(source, context);
  return context.__result;
}

function loadSlotAllocator(slots) {
  const source = `${readPublicFile("js/services/artwork-service.js")
    .replace(/import[\s\S]*?;\s*/g, "")
    .replaceAll("export ", "")}
    globalThis.__result = findAvailableSlotId;`;
  const context = { GALLERY_SLOTS: slots };
  vm.runInNewContext(source, context);
  return context.__result;
}

test("acepta videos MP4 de hasta 45 MiB", () => {
  const { VIDEO_LIMITS, validateSourceVideo } = loadVideoOptimizer();
  const file = {
    name: "obra-final.mp4",
    type: "video/mp4",
    size: 45 * 1024 * 1024
  };

  assert.doesNotThrow(() => validateSourceVideo(file));
  assert.equal(VIDEO_LIMITS.maxSourceSize, file.size);
});

test("rechaza archivos que exceden 45 MiB o no son MP4", () => {
  const { validateSourceVideo } = loadVideoOptimizer();

  assert.throws(
    () => validateSourceVideo({
      name: "obra.mp4",
      type: "video/mp4",
      size: 45 * 1024 * 1024 + 1
    }),
    /45 MB/
  );
  assert.throws(
    () => validateSourceVideo({
      name: "documento.pdf",
      type: "application/pdf",
      size: 1024
    }),
    /Usa un video MP4/
  );
  assert.throws(
    () => validateSourceVideo({
      name: "obra.mov",
      type: "video/quicktime",
      size: 20 * 1024 * 1024
    }),
    /Usa un video MP4/
  );
});

test("calcula el ahorro sin producir valores negativos", () => {
  const { calculateSavings, formatFileSize } = loadVideoOptimizer();
  const savings = calculateSavings(100 * 1024 * 1024, 40 * 1024 * 1024);
  const noSavings = calculateSavings(20, 30);

  assert.equal(savings.savedBytes, 60 * 1024 * 1024);
  assert.equal(Math.round(savings.savedPercent), 60);
  assert.equal(noSavings.savedBytes, 0);
  assert.equal(noSavings.savedPercent, 0);
  assert.equal(formatFileSize(savings.savedBytes), "60.0 MB");
});

test("la galería expone trece ubicaciones únicas", () => {
  const slots = loadGallerySlots();
  const slotIds = slots.map((slot) => slot.id);

  assert.equal(slots.length, 13);
  assert.equal(new Set(slotIds).size, 13);
  assert.equal(slotIds.includes("interior-left-01"), true);
  assert.equal(slotIds.includes("interior-right-01"), true);
  assert.equal(slotIds.includes("lobby-feature-01"), true);
  assert.deepEqual(
    slots.map((slot) => slot.label),
    Array.from({ length: 13 }, (_, index) => `Obra ${index + 1}`)
  );
});

test("asigna siempre el primer número libre sin intervención manual", () => {
  const slots = loadGallerySlots();
  const findAvailableSlotId = loadSlotAllocator(slots);
  const existingArtworks = slots.slice(0, 3).map((slot) => ({
    slot_id: slot.id
  }));

  assert.equal(findAvailableSlotId(existingArtworks), slots[3].id);
  assert.equal(
    findAvailableSlotId(slots.map((slot) => ({ slot_id: slot.id }))),
    null
  );
});

test("las cargas grandes usan bloques TUS de 6 MiB", () => {
  const configuration = loadUploadConfiguration();
  const expectedChunkSize = 6 * 1024 * 1024;

  assert.equal(configuration.resumableThreshold, expectedChunkSize);
  assert.equal(configuration.chunkSize, expectedChunkSize);
});

test("el panel incluye controles y métricas de optimización", () => {
  const dashboard = fs.readFileSync(
    path.join(__dirname, "../views/admin-dashboard.html"),
    "utf8"
  );

  for (const elementId of [
    "optimizer-panel",
    "optimization-progress",
    "storage-total",
    "savings-total",
    "video-dropzone",
    "optimizer-cancel",
    "artwork-submit-help"
  ]) {
    assert.match(dashboard, new RegExp(`id="${elementId}"`));
  }

  assert.match(dashboard, /id="automatic-slot-label"/);
  assert.doesNotMatch(dashboard, /id="artwork-slot"/);
});

test("el administrador no carga motores de compresión", () => {
  const optimizer = readPublicFile("js/admin/video-optimizer.js");
  const vendorRoot = path.join(__dirname, "../public/vendor/ffmpeg");

  assert.equal(fs.existsSync(vendorRoot), false);
  assert.doesNotMatch(optimizer, /FFmpeg|WebAssembly|\.wasm|unpkg|jsdelivr/);
});

test("todo MP4 válido evita la compresión en el navegador", async () => {
  const { VIDEO_LIMITS, optimizeVideo } = loadVideoOptimizer();
  const file = {
    name: "obra.mp4",
    type: "video/mp4",
    size: 45 * 1024 * 1024
  };
  const result = await optimizeVideo(file);

  assert.equal(VIDEO_LIMITS.passthroughSize, 45 * 1024 * 1024);
  assert.equal(result.file, file);
  assert.equal(result.wasOptimized, false);
});

test("la miniatura no puede bloquear indefinidamente la subida", () => {
  const thumbnailGenerator = readPublicFile(
    "js/admin/thumbnail-generator.js"
  );
  const dashboard = readPublicFile("js/admin/admin-dashboard.js");

  assert.match(thumbnailGenerator, /METADATA_TIMEOUT_MS = 15000/);
  assert.match(thumbnailGenerator, /SEEK_TIMEOUT_MS = 10000/);
  assert.match(thumbnailGenerator, /video\.load\(\)/);
  assert.match(dashboard, /value \* 0\.9/);
  assert.match(
    dashboard,
    /setOptimizationProgress\(0\.94, "Generando miniatura"\)/
  );
});
