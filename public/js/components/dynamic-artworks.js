import { GALLERY_SLOTS } from "../config/gallery-slots.js";
import { getSupabaseConfig } from "../services/supabase-client.js";

let isLoading = false;

function findArtworkEntity(slotId) {
  return document.querySelector(`[data-artwork-slot-id="${slotId}"]`)?.closest("[gallery-artwork]");
}

async function loadDynamicArtworks() {
  if (isLoading) return;
  isLoading = true;

  try {
    const config = await getSupabaseConfig();
    const query = new URLSearchParams({
      select: "slot_id,title,author,video_url,thumbnail_url",
      is_active: "eq.true"
    });
    const response = await fetch(
      `${config.url}/rest/v1/artworks?${query}`,
      {
        headers: {
          Accept: "application/json",
          apikey: config.publishableKey
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase respondió ${response.status}.`);
    }

    const artworks = await response.json();
    const artworkBySlot = new Map(
      artworks.map((artwork) => [artwork.slot_id, artwork])
    );
    GALLERY_SLOTS.forEach((slot) => {
      const entity = findArtworkEntity(slot.id);
      const artwork = artworkBySlot.get(slot.id);
      if (!entity) return;
      const current = entity.getAttribute("gallery-artwork");
      entity.setAttribute("gallery-artwork", {
        ...current,
        videoSrc: artwork?.video_url || "",
        thumbnailSrc: artwork?.thumbnail_url || "",
        title: artwork?.title || "",
        author: artwork?.author || ""
      });
    });
    document.querySelector("a-scene")?.emit("artworks-updated", {}, true);
  } catch (error) {
    console.warn("No se pudieron cargar las obras dinámicas.", error);
  } finally {
    isLoading = false;
  }
}

const scene = document.querySelector("a-scene");
if (scene?.hasLoaded) loadDynamicArtworks();
else scene?.addEventListener("loaded", loadDynamicArtworks, { once: true });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadDynamicArtworks();
});
