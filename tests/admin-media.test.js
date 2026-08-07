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

test("acepta fuentes de video de hasta 150 MiB", () => {
  const { VIDEO_LIMITS, validateSourceVideo } = loadVideoOptimizer();
  const file = {
    name: "obra-final.mov",
    type: "video/quicktime",
    size: 150 * 1024 * 1024
  };

  assert.doesNotThrow(() => validateSourceVideo(file));
  assert.equal(VIDEO_LIMITS.maxSourceSize, file.size);
});

test("rechaza archivos que exceden 150 MiB o no son video", () => {
  const { validateSourceVideo } = loadVideoOptimizer();

  assert.throws(
    () => validateSourceVideo({
      name: "obra.mp4",
      type: "video/mp4",
      size: 150 * 1024 * 1024 + 1
    }),
    /150 MB/
  );
  assert.throws(
    () => validateSourceVideo({
      name: "documento.pdf",
      type: "application/pdf",
      size: 1024
    }),
    /Usa un video/
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
    "optimizer-cancel"
  ]) {
    assert.match(dashboard, new RegExp(`id="${elementId}"`));
  }

  assert.match(dashboard, /id="automatic-slot-label"/);
  assert.doesNotMatch(dashboard, /id="artwork-slot"/);
});

test("el optimizador usa un worker FFmpeg local y no una CDN", () => {
  const optimizer = readPublicFile("js/admin/video-optimizer.js");
  const vendorRoot = path.join(__dirname, "../public/vendor/ffmpeg");
  const requiredFiles = [
    "ffmpeg/index.js",
    "ffmpeg/classes.js",
    "ffmpeg/worker.js",
    "core/ffmpeg-core.js",
    "core/ffmpeg-core.wasm"
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(
      fs.existsSync(path.join(vendorRoot, relativePath)),
      true,
      `Falta ${relativePath}`
    );
  }

  assert.match(optimizer, /\/vendor\/ffmpeg\/ffmpeg\/index\.js/);
  assert.match(optimizer, /TRANSCODE_TIMEOUT_MS/);
  assert.doesNotMatch(optimizer, /unpkg\.com|cdn\.jsdelivr\.net/);
  assert.ok(
    fs.statSync(
      path.join(vendorRoot, "core/ffmpeg-core.wasm")
    ).size > 30 * 1024 * 1024
  );
});

test("los MP4 pequenos evitan una compresion innecesaria", () => {
  const { VIDEO_LIMITS } = loadVideoOptimizer();

  assert.equal(VIDEO_LIMITS.passthroughSize, 12 * 1024 * 1024);
});
