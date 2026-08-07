const MEBIBYTE = 1024 * 1024;
const MAX_SOURCE_SIZE = 150 * MEBIBYTE;
const MAX_OUTPUT_SIZE = 45 * MEBIBYTE;
const TARGET_OUTPUT_SIZE = 40 * MEBIBYTE;
const AUDIO_BITRATE_KBPS = 96;
const FFMPEG_SCRIPT_URL =
  "https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js";
const FFMPEG_CORE_URL =
  "https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js";
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

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-video-optimizer="${source}"]`
    );

    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.src = source;
    script.crossOrigin = "anonymous";
    script.dataset.videoOptimizer = source;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener(
      "error",
      () => reject(
        new Error("No se pudo cargar el motor de optimización.")
      ),
      { once: true }
    );
    document.head.appendChild(script);
  });
}

async function getFFmpeg() {
  if (ffmpegInstance?.isLoaded()) {
    return ffmpegInstance;
  }

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      if (!window.FFmpeg?.createFFmpeg) {
        await loadScript(FFMPEG_SCRIPT_URL);
      }

      if (!window.FFmpeg?.createFFmpeg) {
        throw new Error(
          "El navegador no pudo iniciar el optimizador de video."
        );
      }

      const instance = window.FFmpeg.createFFmpeg({
        corePath: FFMPEG_CORE_URL,
        mainName: "main",
        log: false
      });

      instance.setProgress(({ ratio }) => {
        activeProgressCallback?.(
          clamp(Number(ratio) || 0, 0, 1)
        );
      });
      instance.setLogger(({ message }) => {
        const duration = parseDuration(message);

        if (duration > 0) {
          detectedDuration = duration;
        }
      });

      await instance.load();
      ffmpegInstance = instance;
      return instance;
    })().catch((error) => {
      ffmpegLoadPromise = null;
      throw error;
    });
  }

  return ffmpegLoadPromise;
}

function createCommonArguments(inputName) {
  return [
    "-i",
    inputName,
    "-map_metadata",
    "-1",
    "-vf",
    "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    `${AUDIO_BITRATE_KBPS}k`,
    "-ac",
    "2",
    "-movflags",
    "+faststart"
  ];
}

async function readOutput(ffmpeg, outputName, originalFile) {
  const data = ffmpeg.FS("readFile", outputName);
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

function removeVirtualFile(ffmpeg, fileName) {
  try {
    ffmpeg.FS("unlink", fileName);
  } catch (error) {
    // El archivo puede no existir si FFmpeg terminó con error.
  }
}

async function createQualityOutput(ffmpeg, inputName, outputName) {
  await ffmpeg.run(
    ...createCommonArguments(inputName),
    "-crf",
    "27",
    outputName
  );
}

function calculateVideoBitrate(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  const totalKbps = Math.floor(
    (TARGET_OUTPUT_SIZE * 8) / durationSeconds / 1000
  );

  return Math.max(220, totalKbps - AUDIO_BITRATE_KBPS - 24);
}

async function createLimitedOutput(
  ffmpeg,
  inputName,
  outputName,
  durationSeconds
) {
  const videoBitrate = calculateVideoBitrate(durationSeconds);

  if (!videoBitrate) {
    throw new Error(
      "No se pudo calcular una compresión segura para este video."
    );
  }

  await ffmpeg.run(
    ...createCommonArguments(inputName),
    "-b:v",
    `${videoBitrate}k`,
    "-maxrate",
    `${Math.round(videoBitrate * 1.15)}k`,
    "-bufsize",
    `${videoBitrate * 2}k`,
    outputName
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

export async function optimizeVideo(
  originalFile,
  { onProgress, onStage } = {}
) {
  validateSourceVideo(originalFile, true);
  onStage?.("Preparando el motor de optimización");
  onProgress?.(0.01);

  const ffmpeg = await getFFmpeg();
  const inputExtension = getExtension(originalFile.name);
  const jobId = crypto.randomUUID().replaceAll("-", "");
  const inputName = `input-${jobId}.${inputExtension}`;
  const qualityOutputName = `quality-${jobId}.mp4`;
  const limitedOutputName = `limited-${jobId}.mp4`;
  let optimizedFile = null;

  detectedDuration = 0;
  activeProgressCallback = (progress) => {
    onProgress?.(0.08 + progress * 0.78);
  };

  try {
    onStage?.("Leyendo el video en este dispositivo");
    ffmpeg.FS(
      "writeFile",
      inputName,
      await window.FFmpeg.fetchFile(originalFile)
    );

    onStage?.("Comprimiendo y ajustando la resolución");
    await createQualityOutput(
      ffmpeg,
      inputName,
      qualityOutputName
    );
    optimizedFile = await readOutput(
      ffmpeg,
      qualityOutputName,
      originalFile
    );

    if (optimizedFile.size > MAX_OUTPUT_SIZE) {
      onStage?.("Aplicando una segunda optimización de tamaño");
      activeProgressCallback = (progress) => {
        onProgress?.(0.45 + progress * 0.45);
      };
      await createLimitedOutput(
        ffmpeg,
        inputName,
        limitedOutputName,
        detectedDuration
      );
      optimizedFile = await readOutput(
        ffmpeg,
        limitedOutputName,
        originalFile
      );
    }

    if (optimizedFile.size > MAX_OUTPUT_SIZE) {
      throw new Error(
        "El resultado aún supera 45 MB. Reduce la duración del video."
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
  } finally {
    activeProgressCallback = null;
    removeVirtualFile(ffmpeg, inputName);
    removeVirtualFile(ffmpeg, qualityOutputName);
    removeVirtualFile(ffmpeg, limitedOutputName);
  }
}

export const VIDEO_LIMITS = Object.freeze({
  maxSourceSize: MAX_SOURCE_SIZE,
  maxOutputSize: MAX_OUTPUT_SIZE,
  targetOutputSize: TARGET_OUTPUT_SIZE
});
