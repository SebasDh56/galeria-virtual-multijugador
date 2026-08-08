const MAX_THUMBNAIL_WIDTH = 1280;
const METADATA_TIMEOUT_MS = 15000;
const SEEK_TIMEOUT_MS = 10000;

function waitForEvent(target, eventName, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleFailure = () => {
      cleanup();
      reject(new Error("No se pudo leer el video seleccionado."));
    };
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      target.removeEventListener(eventName, handleSuccess);
      target.removeEventListener("error", handleFailure);
    };

    target.addEventListener(eventName, handleSuccess, { once: true });
    target.addEventListener("error", handleFailure, { once: true });
  });
}

function createThumbnailFile(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo crear la miniatura."));
        return;
      }

      resolve(
        new File([blob], "thumbnail.webp", {
          type: "image/webp"
        })
      );
    }, "image/webp", 0.82);
  });
}

export async function generateThumbnail(videoFile) {
  const video = document.createElement("video");
  const sourceUrl = URL.createObjectURL(videoFile);
  let hasValidMetadata = false;

  try {
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const metadataReady = waitForEvent(
      video,
      "loadedmetadata",
      METADATA_TIMEOUT_MS,
      "La miniatura tardó demasiado en leer el video."
    );
    video.src = sourceUrl;
    video.load();

    await metadataReady;

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("El video no tiene una duraci\u00f3n v\u00e1lida.");
    }
    hasValidMetadata = true;

    const thumbnailTime = Math.min(
      Math.max(0.1, video.duration * 0.1),
      Math.max(0.1, video.duration - 0.05),
      1
    );
    const frameReady = waitForEvent(
      video,
      "seeked",
      SEEK_TIMEOUT_MS,
      "La vista previa tardó demasiado en generarse."
    );
    video.currentTime = thumbnailTime;
    await frameReady;

    const scale = Math.min(
      1,
      MAX_THUMBNAIL_WIDTH / video.videoWidth
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d").drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return createThumbnailFile(canvas);
  } catch (error) {
    if (!hasValidMetadata) {
      throw error;
    }

    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = 960;
    fallbackCanvas.height = 540;
    const context = fallbackCanvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 960, 540);
    gradient.addColorStop(0, "#161820");
    gradient.addColorStop(1, "#090a0d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 960, 540);
    context.strokeStyle = "#c8102e";
    context.lineWidth = 10;
    context.strokeRect(330, 120, 300, 300);
    context.fillStyle = "#ffffff";
    context.font = "600 34px sans-serif";
    context.textAlign = "center";
    context.fillText("GALERÍA VIRTUAL", 480, 485);
    return createThumbnailFile(fallbackCanvas);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(sourceUrl);
  }
}
