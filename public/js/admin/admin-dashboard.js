import {
  getCurrentAdmin,
  observeAdminSession,
  signOutAdmin
} from "../services/auth-service.js";
import { GALLERY_SLOTS } from "../config/gallery-slots.js";
import {
  MAX_ARTWORKS,
  createArtwork,
  deleteArtwork,
  fetchArtworks,
  updateArtwork,
  validateVideoFile
} from "../services/artwork-service.js";
import { generateThumbnail } from "./thumbnail-generator.js";
import {
  cancelVideoOptimization,
  formatFileSize,
  optimizeVideo,
  validateSourceVideo
} from "./video-optimizer.js";

const page = document.body;
const statusMessage = document.querySelector("#admin-status");
const form = document.querySelector("#artwork-form");
const formTitle = document.querySelector("#form-title");
const submitButton = document.querySelector("#artwork-submit");
const submitHelp = document.querySelector("#artwork-submit-help");
const cancelButton = document.querySelector("#artwork-cancel");
const logoutButton = document.querySelector("#admin-logout");
const artworkList = document.querySelector("#artwork-list");
const artworkCount = document.querySelector("#artwork-count");
const automaticSlotLabel = document.querySelector(
  "#automatic-slot-label"
);
const videoHelp = document.querySelector("#video-help");
const selectedVideoName = document.querySelector("#selected-video-name");
const videoDropzone = document.querySelector("#video-dropzone");
const thumbnailFigure = document.querySelector("#thumbnail-figure");
const thumbnailPreview = document.querySelector("#thumbnail-preview");
const optimizerPanel = document.querySelector("#optimizer-panel");
const optimizerStage = document.querySelector("#optimizer-stage");
const optimizerPercent = document.querySelector("#optimizer-percent");
const optimizationCancelButton = document.querySelector(
  "#optimizer-cancel"
);
const optimizationProgress = document.querySelector(
  "#optimization-progress"
);
const uploadPanel = document.querySelector("#upload-panel");
const uploadProgress = document.querySelector("#upload-progress");
const uploadProgressLabel = document.querySelector(
  "#upload-progress-label"
);
const originalVideoSize = document.querySelector("#original-video-size");
const optimizedVideoSize = document.querySelector("#optimized-video-size");
const optimizedVideoSavings = document.querySelector(
  "#optimized-video-savings"
);
const metrics = {
  total: document.querySelector("#artwork-total"),
  active: document.querySelector("#active-total"),
  storage: document.querySelector("#storage-total"),
  savings: document.querySelector("#savings-total")
};
const fields = {
  title: document.querySelector("#artwork-title"),
  author: document.querySelector("#artwork-author"),
  description: document.querySelector("#artwork-description"),
  video: document.querySelector("#artwork-video"),
  active: document.querySelector("#artwork-active")
};

let client;
let artworks = [];
let editingArtwork = null;
let preparedVideo = null;
let thumbnailFile = null;
let previewUrl = null;
let isSubmitting = false;
let isProcessingVideo = false;
let authSubscription = null;

function setStatus(message = "", type = "") {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function redirectToLogin() {
  window.location.replace("/admin/login");
}

function getFormValues() {
  return {
    title: fields.title.value,
    author: fields.author.value,
    description: fields.description.value,
    isActive: fields.active.checked
  };
}

function updatePreview(file) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = file ? URL.createObjectURL(file) : null;
  thumbnailPreview.src = previewUrl || "";
  thumbnailFigure.hidden = !previewUrl;
}

function setOptimizationProgress(value, stage) {
  const normalizedValue = Math.min(1, Math.max(0, value));
  optimizerPanel.hidden = false;
  optimizationProgress.value = normalizedValue;
  optimizerPercent.textContent = `${Math.round(normalizedValue * 100)}%`;

  if (stage) {
    optimizerStage.textContent = stage;
  }
}

function resetOptimization() {
  optimizerPanel.hidden = true;
  optimizationCancelButton.hidden = true;
  optimizationCancelButton.disabled = false;
  optimizerPanel.dataset.state = "";
  optimizationProgress.value = 0;
  optimizerPercent.textContent = "0%";
  optimizerStage.textContent = "Preparando video";
  originalVideoSize.textContent = "—";
  optimizedVideoSize.textContent = "—";
  optimizedVideoSavings.textContent = "—";
}

function setUploadProgress(value) {
  const normalizedValue = Math.min(1, Math.max(0, value));
  uploadPanel.hidden = false;
  uploadProgress.value = normalizedValue;
  uploadProgressLabel.textContent = `${Math.round(normalizedValue * 100)}%`;
}

function resetUploadProgress() {
  uploadPanel.hidden = true;
  uploadProgress.value = 0;
  uploadProgressLabel.textContent = "0%";
}

function updateSubmitAvailability() {
  const isAtCapacity = !editingArtwork && artworks.length >= MAX_ARTWORKS;
  submitButton.disabled =
    isSubmitting || isProcessingVideo || isAtCapacity;
  submitButton.title = isAtCapacity
    ? `La galería ya tiene ${MAX_ARTWORKS} obras.`
    : "";

  if (isAtCapacity) {
    submitHelp.textContent =
      `La galería está completa (${MAX_ARTWORKS}/${MAX_ARTWORKS}). Edita o elimina una obra para liberar un espacio.`;
  } else if (isProcessingVideo) {
    submitHelp.textContent =
      "Espera mientras terminamos de preparar el video.";
  } else if (preparedVideo) {
    submitHelp.textContent =
      "Video listo. Ya puedes guardar y subir la obra.";
  } else {
    submitHelp.textContent = "";
  }
}

function getSlotLabel(slotId) {
  return GALLERY_SLOTS.find((slot) => slot.id === slotId)?.label || "Obra";
}

function updateAutomaticSlotLabel() {
  if (editingArtwork) {
    automaticSlotLabel.textContent = getSlotLabel(
      editingArtwork.slot_id
    );
    return;
  }

  const usedSlots = new Set(
    artworks.map((artwork) => artwork.slot_id)
  );
  const availableSlot = GALLERY_SLOTS.find(
    (slot) => !usedSlots.has(slot.id)
  );
  automaticSlotLabel.textContent =
    availableSlot?.label || "Galería completa";
}

function renderMetrics() {
  const activeArtworks = artworks.filter(
    (artwork) => artwork.is_active
  ).length;
  const storageBytes = artworks.reduce(
    (total, artwork) => total + (Number(artwork.video_size_bytes) || 0),
    0
  );
  const savingsBytes = artworks.reduce((total, artwork) => {
    const originalSize = Number(artwork.original_size_bytes) || 0;
    const storedSize = Number(artwork.video_size_bytes) || 0;
    return total + Math.max(0, originalSize - storedSize);
  }, 0);

  metrics.total.textContent = `${artworks.length} / ${MAX_ARTWORKS}`;
  metrics.active.textContent = `${activeArtworks} / ${GALLERY_SLOTS.length}`;
  metrics.storage.textContent = formatFileSize(storageBytes);
  metrics.savings.textContent = formatFileSize(savingsBytes);
  artworkCount.textContent = `${activeArtworks} activas · ${artworks.length} registradas`;
}

function createActionButton(label, actionName, artwork, secondary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = actionName;
  button.dataset.id = artwork.id;

  if (secondary) {
    button.className = "admin-button-secondary";
  }

  return button;
}

function createArtworkCard(artwork) {
  const card = document.createElement("article");
  const image = document.createElement("img");
  const details = document.createElement("div");
  const heading = document.createElement("h3");
  const metadata = document.createElement("p");
  const badges = document.createElement("div");
  const state = document.createElement("span");
  const fileSize = document.createElement("span");
  const actions = document.createElement("div");

  card.className = "admin-artwork-item";
  image.src = artwork.thumbnail_url;
  image.alt = `Miniatura de ${artwork.title}`;
  image.loading = "lazy";
  heading.textContent = artwork.title;
  metadata.textContent = `${artwork.author} · ${getSlotLabel(
    artwork.slot_id
  )}`;
  badges.className = "admin-item-badges";
  state.className = artwork.is_active
    ? "admin-state active"
    : "admin-state";
  state.textContent = artwork.is_active ? "Activa" : "Inactiva";
  fileSize.className = "admin-file-size";
  fileSize.textContent = formatFileSize(artwork.video_size_bytes);
  badges.append(state, fileSize);
  details.append(heading, metadata, badges);

  actions.className = "admin-item-actions";
  actions.append(
    createActionButton("Editar", "edit", artwork, true),
    createActionButton(
      artwork.is_active ? "Desactivar" : "Activar",
      "toggle",
      artwork,
      true
    ),
    createActionButton("Eliminar", "delete", artwork)
  );
  card.append(image, details, actions);
  return card;
}

function renderArtworks() {
  renderMetrics();
  updateAutomaticSlotLabel();
  artworkList.replaceChildren();

  if (!artworks.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "admin-empty-state";
    emptyState.textContent =
      "Aún no hay obras registradas. Publica la primera desde el formulario.";
    artworkList.appendChild(emptyState);
  } else {
    artworkList.append(...artworks.map(createArtworkCard));
  }

  updateSubmitAvailability();
}

async function loadArtworks() {
  artworks = await fetchArtworks(client);
  renderArtworks();
}

function resetPreparedMedia() {
  preparedVideo = null;
  thumbnailFile = null;
  updatePreview(null);
  resetOptimization();
  selectedVideoName.textContent =
    "MP4 comprimido previamente · máximo 45 MB";
}

function resetForm() {
  editingArtwork = null;
  form.reset();
  fields.active.checked = true;
  fields.video.required = true;
  fields.video.disabled = false;
  formTitle.textContent = "Añadir obra";
  submitButton.textContent = "Guardar obra";
  cancelButton.hidden = true;
  videoHelp.textContent =
    "Obligatorio al crear. Comprímelo antes con HandBrake si supera 45 MB.";
  resetPreparedMedia();
  resetUploadProgress();
  updateAutomaticSlotLabel();
  updateSubmitAvailability();
}

function showOptimizationResult(result) {
  originalVideoSize.textContent = formatFileSize(result.originalSize);
  optimizedVideoSize.textContent = "45.0 MB";
  optimizedVideoSavings.textContent = "Aprobado";
  optimizerPanel.dataset.state = "ready";
}

async function prepareVideo(sourceVideo) {
  isProcessingVideo = true;
  fields.video.disabled = true;
  updateSubmitAvailability();
  resetPreparedMedia();
  selectedVideoName.textContent = sourceVideo.name;
  originalVideoSize.textContent = formatFileSize(sourceVideo.size);
  setOptimizationProgress(0.01, "Validando MP4");
  optimizationCancelButton.hidden = true;
  optimizationCancelButton.disabled = false;

  try {
    validateSourceVideo(sourceVideo, true);
    preparedVideo = await optimizeVideo(sourceVideo, {
      onProgress: (value) => setOptimizationProgress(value * 0.9),
      onStage: (stage) => setOptimizationProgress(
        optimizationProgress.value,
        stage
      )
    });
    validateVideoFile(preparedVideo.file, true);
    setOptimizationProgress(0.94, "Generando miniatura");
    thumbnailFile = await generateThumbnail(preparedVideo.file);
    updatePreview(thumbnailFile);
    showOptimizationResult(preparedVideo);
    setOptimizationProgress(
      1,
      preparedVideo.wasOptimized
        ? "Video preparado y listo"
        : "MP4 validado y listo para subir"
    );
    setStatus(
      "MP4 validado. Ya puedes guardar y subir la obra.",
      "success"
    );
  } catch (error) {
    if (error.name === "AbortError") {
      fields.video.value = "";
      resetPreparedMedia();
      setStatus(error.message, "warning");
      return;
    }

    try {
      validateVideoFile(sourceVideo, true);
      preparedVideo = {
        file: sourceVideo,
        originalSize: sourceVideo.size,
        optimizedSize: sourceVideo.size,
        wasOptimized: false
      };
      setOptimizationProgress(0.94, "Generando miniatura");
      thumbnailFile = await generateThumbnail(sourceVideo);
      updatePreview(thumbnailFile);
      setOptimizationProgress(1, "Se conservará el MP4 original");
      showOptimizationResult(preparedVideo);
      setStatus(
        `No se pudo comprimir, pero el MP4 ya cumple el límite de 45 MB. ${error.message}`,
        "warning"
      );
    } catch (fallbackError) {
      fields.video.value = "";
      resetPreparedMedia();
      setStatus(error.message || fallbackError.message);
    }
  } finally {
    isProcessingVideo = false;
    fields.video.disabled = false;
    optimizationCancelButton.hidden = true;
    optimizationCancelButton.disabled = false;
    updateSubmitAvailability();
  }
}

async function handleVideoChange() {
  const sourceVideo = fields.video.files[0];

  if (!sourceVideo) {
    resetPreparedMedia();
    return;
  }

  await prepareVideo(sourceVideo);
}

function beginEdit(artwork) {
  editingArtwork = artwork;
  fields.title.value = artwork.title;
  fields.author.value = artwork.author;
  fields.description.value = artwork.description || "";
  fields.active.checked = artwork.is_active;
  fields.video.required = false;
  formTitle.textContent = "Editar obra";
  submitButton.textContent = "Actualizar obra";
  cancelButton.hidden = false;
  videoHelp.textContent =
    "Déjalo vacío para conservar el video y la miniatura actuales.";
  resetPreparedMedia();
  updateAutomaticSlotLabel();
  updateSubmitAvailability();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveArtwork(event) {
  event.preventDefault();

  if (isSubmitting || isProcessingVideo) {
    return;
  }

  if (!editingArtwork && !preparedVideo) {
    setStatus("Espera a que termine la validación del video.");
    return;
  }

  isSubmitting = true;
  updateSubmitAvailability();
  setStatus("");
  setUploadProgress(0.01);

  try {
    const payload = {
      client,
      values: getFormValues(),
      videoFile: preparedVideo?.file,
      originalVideoSize: preparedVideo?.originalSize,
      thumbnailFile,
      onProgress: setUploadProgress
    };

    if (editingArtwork) {
      await updateArtwork({ ...payload, artwork: editingArtwork });
    } else {
      await createArtwork(payload);
    }

    await loadArtworks();
    resetForm();
    setStatus("Obra guardada correctamente.", "success");
  } catch (error) {
    setStatus(error.message || "No se pudo guardar la obra.");
  } finally {
    isSubmitting = false;
    resetUploadProgress();
    updateSubmitAvailability();
  }
}

async function handleListAction(event) {
  const button = event.target.closest("button[data-action]");

  if (!button || isSubmitting) {
    return;
  }

  const artwork = artworks.find(
    (item) => item.id === button.dataset.id
  );

  if (!artwork) {
    return;
  }

  if (button.dataset.action === "edit") {
    beginEdit(artwork);
    return;
  }

  if (
    button.dataset.action === "delete" &&
    !window.confirm(`¿Eliminar “${artwork.title}” y sus archivos?`)
  ) {
    return;
  }

  isSubmitting = true;
  updateSubmitAvailability();

  try {
    if (button.dataset.action === "delete") {
      await deleteArtwork(client, artwork);
    } else {
      await updateArtwork({
        client,
        artwork,
        values: {
          title: artwork.title,
          author: artwork.author,
          description: artwork.description,
          isActive: !artwork.is_active
        }
      });
    }

    await loadArtworks();

    if (editingArtwork?.id === artwork.id) {
      resetForm();
    }

    setStatus("Cambios guardados.", "success");
  } catch (error) {
    setStatus(error.message || "No se pudo completar la acción.");
  } finally {
    isSubmitting = false;
    updateSubmitAvailability();
  }
}

function handleDroppedVideo(event) {
  event.preventDefault();
  videoDropzone.classList.remove("is-dragging");
  const droppedFile = event.dataTransfer?.files?.[0];

  if (!droppedFile) {
    return;
  }

  try {
    const transfer = new DataTransfer();
    transfer.items.add(droppedFile);
    fields.video.files = transfer.files;
    fields.video.dispatchEvent(new Event("change"));
  } catch (error) {
    setStatus("Selecciona el archivo con el botón del navegador.");
  }
}

async function initializeDashboard() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      redirectToLogin();
      return;
    }

    client = admin.client;
    document.querySelector("#admin-email-label").textContent =
      admin.user.email;
    await loadArtworks();
    resetForm();
    page.classList.remove("auth-pending");
    authSubscription = observeAdminSession(client, redirectToLogin);
  } catch (error) {
    setStatus(error.message);
    page.classList.remove("auth-pending");
  }
}

form.addEventListener("submit", saveArtwork);
fields.video.addEventListener("change", handleVideoChange);
cancelButton.addEventListener("click", resetForm);
artworkList.addEventListener("click", handleListAction);
videoDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  videoDropzone.classList.add("is-dragging");
});
videoDropzone.addEventListener("dragleave", () => {
  videoDropzone.classList.remove("is-dragging");
});
videoDropzone.addEventListener("drop", handleDroppedVideo);
optimizationCancelButton.addEventListener("click", () => {
  optimizationCancelButton.disabled = true;
  optimizerStage.textContent = "Cancelando optimización";
  cancelVideoOptimization();
});
logoutButton.addEventListener("click", async () => {
  if (!client) {
    return;
  }

  logoutButton.disabled = true;

  try {
    await signOutAdmin(client);
  } finally {
    redirectToLogin();
  }
});
window.addEventListener("pagehide", () => {
  authSubscription?.unsubscribe();

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
});

initializeDashboard();
