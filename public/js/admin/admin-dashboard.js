import { getCurrentAdmin, observeAdminSession, signOutAdmin } from "../services/auth-service.js";
import { GALLERY_SLOTS } from "../config/gallery-slots.js";
import { createArtwork, deleteArtwork, fetchArtworks, updateArtwork, validateVideoFile } from "../services/artwork-service.js";
import { generateThumbnail } from "./thumbnail-generator.js";

const page = document.body;
const status = document.querySelector("#admin-status");
const form = document.querySelector("#artwork-form");
const fields = {
  title: document.querySelector("#artwork-title"), author: document.querySelector("#artwork-author"),
  description: document.querySelector("#artwork-description"), slot: document.querySelector("#artwork-slot"),
  video: document.querySelector("#artwork-video"), active: document.querySelector("#artwork-active")
};
const preview = document.querySelector("#thumbnail-preview");
const progress = document.querySelector("#upload-progress");
const progressLabel = document.querySelector("#upload-progress-label");
const list = document.querySelector("#artwork-list");
const count = document.querySelector("#artwork-count");
const formTitle = document.querySelector("#form-title");
const submitButton = document.querySelector("#artwork-submit");
const cancelButton = document.querySelector("#artwork-cancel");
const logoutButton = document.querySelector("#admin-logout");
let client; let artworks = []; let editingArtwork; let thumbnailFile; let previewUrl; let isSubmitting; let authSubscription;

function setStatus(message = "", type = "") { status.textContent = message; status.dataset.type = type; }
function setProgress(value) { progress.hidden = false; progress.value = value; progressLabel.textContent = `${Math.round(value * 100)}%`; }
function resetProgress() { progress.hidden = true; progress.value = 0; progressLabel.textContent = ""; }
function redirectToLogin() { window.location.replace("/admin/login"); }
function values() { return { title: fields.title.value, author: fields.author.value, description: fields.description.value, slotId: fields.slot.value, isActive: fields.active.checked }; }
function updatePreview(file) { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = file ? URL.createObjectURL(file) : null; preview.hidden = !previewUrl; preview.src = previewUrl || ""; }

function renderSlotOptions() {
  const occupied = new Set(artworks.filter((artwork) => artwork.is_active && artwork.id !== editingArtwork?.id).map((artwork) => artwork.slot_id));
  fields.slot.replaceChildren(...GALLERY_SLOTS.map((slot) => { const option = new Option(slot.label, slot.id); option.disabled = occupied.has(slot.id); return option; }));
  if (editingArtwork) fields.slot.value = editingArtwork.slot_id;
}
function resetForm() { editingArtwork = null; form.reset(); fields.active.checked = true; thumbnailFile = null; updatePreview(null); resetProgress(); formTitle.textContent = "Añadir obra"; submitButton.textContent = "Guardar obra"; cancelButton.hidden = true; fields.video.required = true; document.querySelector("#video-help").textContent = "Obligatorio al crear. La miniatura se genera en este navegador."; renderSlotOptions(); }
function action(label, actionName, artwork, secondary = false) { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.dataset.action = actionName; button.dataset.id = artwork.id; if (secondary) button.className = "admin-button-secondary"; return button; }
function renderArtworks() {
  count.textContent = `${artworks.filter((artwork) => artwork.is_active).length} / 10 activas`; list.replaceChildren();
  if (!artworks.length) { list.textContent = "Aún no hay obras registradas."; return; }
  artworks.forEach((artwork) => {
    const card = document.createElement("article"); card.className = "admin-artwork-item";
    const image = document.createElement("img"); image.src = artwork.thumbnail_url; image.alt = `Miniatura de ${artwork.title}`; image.loading = "lazy";
    const details = document.createElement("div"); const heading = document.createElement("h3"); heading.textContent = artwork.title;
    const meta = document.createElement("p"); const slot = GALLERY_SLOTS.find((item) => item.id === artwork.slot_id); meta.textContent = `${artwork.author} · ${slot?.label || artwork.slot_id}`;
    const state = document.createElement("span"); state.className = artwork.is_active ? "admin-state active" : "admin-state"; state.textContent = artwork.is_active ? "Activa" : "Inactiva"; details.append(heading, meta, state);
    const actions = document.createElement("div"); actions.className = "admin-item-actions"; actions.append(action("Editar", "edit", artwork, true), action(artwork.is_active ? "Desactivar" : "Activar", "toggle", artwork, true), action("Eliminar", "delete", artwork));
    card.append(image, details, actions); list.appendChild(card);
  });
}
async function loadArtworks() { artworks = await fetchArtworks(client); renderArtworks(); renderSlotOptions(); }
async function handleVideoChange() { const videoFile = fields.video.files[0]; thumbnailFile = null; updatePreview(null); if (!videoFile) return; try { validateVideoFile(videoFile, true); setStatus("Generando miniatura local...", "info"); thumbnailFile = await generateThumbnail(videoFile); updatePreview(thumbnailFile); setStatus(""); } catch (error) { fields.video.value = ""; setStatus(error.message); } }
function beginEdit(artwork) { editingArtwork = artwork; fields.title.value = artwork.title; fields.author.value = artwork.author; fields.description.value = artwork.description || ""; fields.active.checked = artwork.is_active; thumbnailFile = null; updatePreview(null); renderSlotOptions(); formTitle.textContent = "Editar obra"; submitButton.textContent = "Actualizar obra"; cancelButton.hidden = false; fields.video.required = false; document.querySelector("#video-help").textContent = "Déjalo vacío para conservar el video actual."; window.scrollTo({ top: 0, behavior: "smooth" }); }
async function saveArtwork(event) { event.preventDefault(); if (isSubmitting) return; isSubmitting = true; submitButton.disabled = true; setStatus(""); setProgress(.02); try { const payload = { client, values: values(), videoFile: fields.video.files[0], thumbnailFile, onProgress: setProgress }; if (editingArtwork) await updateArtwork({ ...payload, artwork: editingArtwork }); else await createArtwork(payload); await loadArtworks(); resetForm(); setStatus("Obra guardada correctamente.", "info"); } catch (error) { setStatus(error.message || "No se pudo guardar la obra."); } finally { isSubmitting = false; submitButton.disabled = false; resetProgress(); } }
async function handleListAction(event) { const button = event.target.closest("button[data-action]"); if (!button || isSubmitting) return; const artwork = artworks.find((item) => item.id === button.dataset.id); if (!artwork) return; if (button.dataset.action === "edit") return beginEdit(artwork); if (button.dataset.action === "delete" && !window.confirm(`¿Eliminar “${artwork.title}” y sus archivos?`)) return; isSubmitting = true; try { if (button.dataset.action === "delete") await deleteArtwork(client, artwork); else await updateArtwork({ client, artwork, values: { title: artwork.title, author: artwork.author, description: artwork.description, slotId: artwork.slot_id, isActive: !artwork.is_active } }); await loadArtworks(); if (editingArtwork?.id === artwork.id) resetForm(); setStatus("Cambios guardados.", "info"); } catch (error) { setStatus(error.message || "No se pudo completar la acción."); } finally { isSubmitting = false; } }
async function initializeDashboard() { try { const admin = await getCurrentAdmin(); if (!admin) return redirectToLogin(); client = admin.client; document.querySelector("#admin-email-label").textContent = admin.user.email; await loadArtworks(); page.classList.remove("auth-pending"); authSubscription = observeAdminSession(client, redirectToLogin); } catch (error) { setStatus(error.message); page.classList.remove("auth-pending"); } }
form.addEventListener("submit", saveArtwork); fields.video.addEventListener("change", handleVideoChange); cancelButton.addEventListener("click", resetForm); list.addEventListener("click", handleListAction);
logoutButton.addEventListener("click", async () => { if (!client) return; logoutButton.disabled = true; try { await signOutAdmin(client); } finally { redirectToLogin(); } });
window.addEventListener("pagehide", () => { authSubscription?.unsubscribe(); if (previewUrl) URL.revokeObjectURL(previewUrl); }); initializeDashboard();
