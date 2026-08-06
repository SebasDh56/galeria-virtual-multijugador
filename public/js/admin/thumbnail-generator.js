const MAX_THUMBNAIL_WIDTH = 1280;

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleFailure = () => {
      cleanup();
      reject(new Error("No se pudo leer el video seleccionado."));
    };
    const cleanup = () => {
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

  try {
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = sourceUrl;

    await waitForEvent(video, "loadedmetadata");

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("El video no tiene una duraci\u00f3n v\u00e1lida.");
    }

    video.currentTime = Math.min(
      Math.max(0.1, video.duration * 0.1),
      Math.max(0.1, video.duration - 0.05),
      1
    );
    await waitForEvent(video, "seeked");

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
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(sourceUrl);
  }
}
