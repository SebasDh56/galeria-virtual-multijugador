const MEBIBYTE = 1024 * 1024;
const MAX_VIDEO_SIZE = 45 * MEBIBYTE;

function getExtension(fileName) {
  return String(fileName || "")
    .split(".")
    .pop()
    .toLowerCase();
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
      throw new Error("Selecciona un archivo de video MP4.");
    }

    return;
  }

  const isMp4 =
    getExtension(file.name) === "mp4" &&
    (!file.type || file.type === "video/mp4");

  if (!isMp4) {
    throw new Error(
      "Usa un video MP4 comprimido previamente con HandBrake."
    );
  }

  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error("El video MP4 no puede superar 45 MB.");
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
  // Se conserva para mantener estable la API pública del panel.
}

export async function optimizeVideo(
  originalFile,
  { onProgress, onStage } = {}
) {
  onStage?.("Validando MP4 y límite de 45 MB");
  onProgress?.(0.5);
  validateSourceVideo(originalFile, true);
  onProgress?.(1);
  onStage?.("MP4 listo para subir");

  return {
    file: originalFile,
    originalSize: originalFile.size,
    optimizedSize: originalFile.size,
    wasOptimized: false,
    ...calculateSavings(originalFile.size, originalFile.size)
  };
}

export const VIDEO_LIMITS = Object.freeze({
  maxSourceSize: MAX_VIDEO_SIZE,
  maxOutputSize: MAX_VIDEO_SIZE,
  targetOutputSize: MAX_VIDEO_SIZE,
  passthroughSize: MAX_VIDEO_SIZE
});
