const MEBIBYTE = 1024 * 1024;
const MAX_SOURCE_SIZE = 150 * MEBIBYTE;
const MAX_OUTPUT_SIZE = 45 * MEBIBYTE;
const TARGET_OUTPUT_SIZE = 40 * MEBIBYTE;
const PASSTHROUGH_SIZE = 12 * MEBIBYTE;
const AUDIO_BITRATE_KBPS = 96;
const ENGINE_LOAD_TIMEOUT_MS = 90000;
const PROBE_TIMEOUT_MS = 30000;
const TRANSCODE_TIMEOUT_MS = 25 * 60 * 1000;
const FFMPEG_MODULE_URL = "/vendor/ffmpeg/ffmpeg/index.js";
const FFMPEG_CORE_URL = "/vendor/ffmpeg/core/ffmpeg-core.js";
const FFMPEG_WASM_URL = "/vendor/ffmpeg/core/ffmpeg-core.wasm";
const SUPPORTED_EXTENSIONS = new Set([
  "avi",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "mpeg",
  "mpg",
  "ogv",
  "webm"
]);

let ffmpegInstance = null;
let ffmpegLoadPromise = null;
let activeProgressCallback = null;
let detectedDuration = 0;
let cancellationRequested = false;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getExtension(fileName) {
  return String(fileName || "")
    .split(".")
    .pop()
    .toLowerCase();
}

function getSafeBaseName(fileName) {
  const withoutExtension = String(fileName || "video")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return withoutExtension || "video";
}

function parseDuration(message) {
  const match = String(message).match(
    /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/
  );

  if (!match) {
    return 0;
  }

  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3])
  );
}

function createCancelledError() {
  const error = new Error(
    "Optimización cancelada. Puedes seleccionar el video nuevamente."
  );
  error.name = "AbortError";
  return error;
}

function resetFFmpeg() {
  try {
    ffmpegInstance?.terminate();
  } catch (error) {
    // La instancia puede haber terminado por un tiempo límite.
  }

  ffmpegInstance = null;
  ffmpegLoadPromise = null;
}

function withTimeout(promise, timeoutMs, onTimeout) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      onTimeout?.();
      reject(
        new Error(
          "El motor de video tardó demasiado en iniciar. Intenta nuevamente."
        )
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

async function getFFmpeg() {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const { FFmpeg } = await import(FFMPEG_MODULE_URL);
      const instance = new FFmpeg();

      instance.on("progress", ({ progress }) => {
        activeProgressCallback?.(
          clamp(Number(progress) || 0, 0, 1)
        );
      });
      instance.on("log", ({ message }) => {
        const duration = parseDuration(message);

        if (duration > 0) {
          detectedDuration = duration;
        }
      });

      ffmpegInstance = instance;
      const coreURL = new URL(
        FFMPEG_CORE_URL,
        window.location.origin
      ).href;
      const wasmURL = new URL(
        FFMPEG_WASM_URL,
        window.location.origin
      ).href;

      await withTimeout(
        instance.load({ coreURL, wasmURL }),
        ENGINE_LOAD_TIMEOUT_MS,
        resetFFmpeg
      );
      return instance;
    })().catch((error) => {
      resetFFmpeg();
      throw error;
    });
  }

  return ffmpegLoadPromise;
}

function getScaleFilter(videoBitrate) {
  const maximumDimension = videoBitrate < 700
    ? 854
    : videoBitrate < 1200
      ? 960
      : 1280;

  return `scale=w='min(${maximumDimension},iw)':h='min(${maximumDimension},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30`;
}

function calculateVideoBitrate(durationSeconds, sourceSize) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  const desiredOutputSize = Math.min(
    TARGET_OUTPUT_SIZE,
    sourceSize * 0.82
  );
  const totalKbps = Math.floor(
    (desiredOutputSize * 8) / durationSeconds / 1000
  );

  return clamp(
    totalKbps - AUDIO_BITRATE_KBPS - 28,
    160,
    3500
  );
}

function createTranscodeArguments(
  inputName,
  outputName,
  videoBitrate
) {
  return [
    "-i",
    inputName,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-map_metadata",
    "-1",
    "-vf",
    getScaleFilter(videoBitrate),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    `${Math.round(videoBitrate)}k`,
    "-maxrate",
    `${Math.round(videoBitrate * 1.12)}k`,
    "-bufsize",
    `${Math.round(videoBitrate * 2)}k`,
    "-threads",
    "1",
    "-c:a",
    "aac",
    "-b:a",
    `${AUDIO_BITRATE_KBPS}k`,
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputName
  ];
}

async function readDuration(ffmpeg, inputName, durationFileName) {
  const probeResult = await ffmpeg.ffprobe(
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputName,
      "-o",
      durationFileName
    ],
    PROBE_TIMEOUT_MS
  );

  if (probeResult !== 0) {
    return detectedDuration;
  }

  const durationData = await ffmpeg.readFile(durationFileName);
  const duration = Number(
    new TextDecoder().decode(durationData).trim()
  );

  return Number.isFinite(duration) && duration > 0
    ? duration
    : detectedDuration;
}

function readBrowserDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const videoURL = URL.createObjectURL(file);
    let timeoutId;
    let isSettled = false;

    const finish = (duration = 0) => {
      if (isSettled) return;

      isSettled = true;
      window.clearTimeout(timeoutId);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(videoURL);
      resolve(
        Number.isFinite(duration) && duration > 0
          ? duration
          : 0
      );
    };
    const inspectDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        finish(video.duration);
        return;
      }

      if (video.duration === Infinity) {
        video.currentTime = Number.MAX_SAFE_INTEGER;
      }
    };

    video.preload = "metadata";
    video.muted = true;
    video.addEventListener("loadedmetadata", inspectDuration);
    video.addEventListener("durationchange", inspectDuration);
    video.addEventListener("error", () => finish());
    timeoutId = window.setTimeout(() => finish(), 8000);
    video.src = videoURL;
    video.load();
  });
}

async function readOutput(ffmpeg, outputName, originalFile) {
  const data = await ffmpeg.readFile(outputName);
  const outputNameBase = getSafeBaseName(originalFile.name);

  return new File(
    [data],
    `${outputNameBase}-optimizado.mp4`,
    {
      type: "video/mp4",
      lastModified: Date.now()
    }
  );
}

async function removeVirtualFile(ffmpeg, fileName) {
  try {
    await ffmpeg.deleteFile(fileName);
  } catch (error) {
    // El archivo puede no existir si el proceso fue cancelado.
  }
}

function canUseOriginalDirectly(file) {
  return (
    getExtension(file.name) === "mp4" &&
    file.type === "video/mp4" &&
    file.size <= PASSTHROUGH_SIZE
  );
}

export function formatFileSize(bytes) {
  const numericBytes = Number(bytes) || 0;

  if (numericBytes < MEBIBYTE) {
    return `${Math.max(0, numericBytes / 1024).toFixed(1)} KB`;
  }

  return `${(numericBytes / MEBIBYTE).toFixed(1)} MB`;
}

export function validateSourceVideo(file, isRequired = true) {
  if (!file) {
    if (isRequired) {
      throw new Error("Selecciona un archivo de video.");
    }

    return;
  }

  const extension = getExtension(file.name);
  const hasVideoMime =
    !file.type || file.type.startsWith("video/");

  if (!hasVideoMime || !SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(
      "Usa un video MP4, MOV, M4V, WebM, AVI, MKV, MPEG u OGV."
    );
  }

  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("El archivo original no puede superar 150 MB.");
  }
}

export function calculateSavings(originalSize, optimizedSize) {
  const savedBytes = Math.max(0, originalSize - optimizedSize);
  const savedPercent = originalSize > 0
    ? (savedBytes / originalSize) * 100
    : 0;

  return { savedBytes, savedPercent };
}

export function cancelVideoOptimization() {
  cancellationRequested = true;
  resetFFmpeg();
}

export async function optimizeVideo(
  originalFile,
  { onProgress, onStage } = {}
) {
  validateSourceVideo(originalFile, true);
  cancellationRequested = false;

  if (canUseOriginalDirectly(originalFile)) {
    onStage?.("El video ya está optimizado");
    onProgress?.(1);
    return {
      file: originalFile,
      originalSize: originalFile.size,
      optimizedSize: originalFile.size,
      wasOptimized: false,
      ...calculateSavings(originalFile.size, originalFile.size)
    };
  }

  onStage?.("Iniciando el optimizador local");
  onProgress?.(0.01);

  let ffmpeg;

  try {
    ffmpeg = await getFFmpeg();
  } catch (error) {
    if (
      cancellationRequested ||
      error?.message?.toLowerCase().includes("terminate")
    ) {
      throw createCancelledError();
    }

    throw error;
  }

  if (cancellationRequested) {
    throw createCancelledError();
  }

  const inputExtension = getExtension(originalFile.name);
  const jobId = crypto.randomUUID().replaceAll("-", "");
  const inputName = `input-${jobId}.${inputExtension}`;
  const outputName = `output-${jobId}.mp4`;
  const durationFileName = `duration-${jobId}.txt`;
  detectedDuration = 0;

  try {
    onStage?.("Preparando el archivo sin enviarlo a internet");
    onProgress?.(0.08);
    await ffmpeg.writeFile(
      inputName,
      new Uint8Array(await originalFile.arrayBuffer())
    );

    if (cancellationRequested) {
      throw createCancelledError();
    }

    onStage?.("Analizando duración y calidad");
    let duration = await readDuration(
      ffmpeg,
      inputName,
      durationFileName
    );

    if (!duration) {
      duration = await readBrowserDuration(originalFile);
    }
    const videoBitrate = calculateVideoBitrate(
      duration,
      originalFile.size
    );

    if (!videoBitrate) {
      throw new Error(
        "No se pudo leer la duración del video. Convierte el archivo a MP4 e intenta nuevamente."
      );
    }

    onStage?.("Comprimiendo en segundo plano");
    activeProgressCallback = (progress) => {
      onProgress?.(0.12 + progress * 0.82);
    };
    const result = await ffmpeg.exec(
      createTranscodeArguments(
        inputName,
        outputName,
        videoBitrate
      ),
      TRANSCODE_TIMEOUT_MS
    );

    if (cancellationRequested) {
      throw createCancelledError();
    }

    if (result !== 0) {
      throw new Error(
        result === 1
          ? "La compresión superó el tiempo permitido. Prueba con un video más corto."
          : "No se pudo convertir este video."
      );
    }

    const optimizedFile = await readOutput(
      ffmpeg,
      outputName,
      originalFile
    );

    if (optimizedFile.size > MAX_OUTPUT_SIZE) {
      throw new Error(
        "El resultado supera 45 MB. Reduce la duración del video e intenta nuevamente."
      );
    }

    const sourceCanBePreserved =
      inputExtension === "mp4" &&
      originalFile.type === "video/mp4" &&
      originalFile.size <= MAX_OUTPUT_SIZE;
    const selectedFile =
      sourceCanBePreserved && originalFile.size <= optimizedFile.size
        ? originalFile
        : optimizedFile;
    const savings = calculateSavings(
      originalFile.size,
      selectedFile.size
    );

    onProgress?.(1);
    onStage?.("Video listo para subir");

    return {
      file: selectedFile,
      originalSize: originalFile.size,
      optimizedSize: selectedFile.size,
      wasOptimized: selectedFile !== originalFile,
      ...savings
    };
  } catch (error) {
    if (cancellationRequested || error?.message?.includes("terminate")) {
      throw createCancelledError();
    }

    throw error;
  } finally {
    activeProgressCallback = null;
    await Promise.allSettled([
      removeVirtualFile(ffmpeg, inputName),
      removeVirtualFile(ffmpeg, outputName),
      removeVirtualFile(ffmpeg, durationFileName)
    ]);
  }
}

export const VIDEO_LIMITS = Object.freeze({
  maxSourceSize: MAX_SOURCE_SIZE,
  maxOutputSize: MAX_OUTPUT_SIZE,
  targetOutputSize: TARGET_OUTPUT_SIZE,
  passthroughSize: PASSTHROUGH_SIZE
});
