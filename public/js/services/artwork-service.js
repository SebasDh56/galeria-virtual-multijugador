import { GALLERY_SLOTS } from "../config/gallery-slots.js";
import {
  getPublicUrl,
  removeFiles,
  uploadWithProgress
} from "./storage-service.js";

const VIDEO_BUCKET = "artwork-videos";
const THUMBNAIL_BUCKET = "artwork-thumbnails";
const MAX_VIDEO_SIZE = 45 * 1024 * 1024;

function createAssetPath(artworkId, extension) {
  return `artworks/${artworkId}/${crypto.randomUUID()}.${extension}`;
}

function cleanText(value) {
  return String(value || "").trim();
}

function validateMetadata(values) {
  const title = cleanText(values.title);
  const author = cleanText(values.author);
  const description = cleanText(values.description);

  if (!title || title.length > 120) {
    throw new Error("El nombre debe tener entre 1 y 120 caracteres.");
  }

  if (!author || author.length > 100) {
    throw new Error("El autor debe tener entre 1 y 100 caracteres.");
  }

  if (description.length > 500) {
    throw new Error("La descripci\u00f3n no puede superar 500 caracteres.");
  }

  if (!GALLERY_SLOTS.some((slot) => slot.id === values.slotId)) {
    throw new Error("Selecciona una ubicaci\u00f3n v\u00e1lida.");
  }

  return { title, author, description: description || null };
}

export function validateVideoFile(videoFile, isRequired) {
  if (!videoFile) {
    if (isRequired) {
      throw new Error("Selecciona un video MP4.");
    }

    return;
  }

  if (videoFile.type !== "video/mp4") {
    throw new Error("Solo se permiten archivos MP4.");
  }

  if (videoFile.size > MAX_VIDEO_SIZE) {
    throw new Error("El video no puede superar 45 MB.");
  }
}

export async function fetchArtworks(client) {
  const { data, error } = await client
    .from("artworks")
    .select(
      "id, title, author, description, video_path, video_url, thumbnail_path, thumbnail_url, slot_id, is_active, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No se pudieron cargar las obras.");
  }

  return data || [];
}

async function uploadAssets({
  client,
  artworkId,
  videoFile,
  thumbnailFile,
  onProgress
}) {
  const videoPath = createAssetPath(artworkId, "mp4");
  const thumbnailPath = createAssetPath(artworkId, "webp");

  await uploadWithProgress({
    client,
    bucket: VIDEO_BUCKET,
    path: videoPath,
    file: videoFile,
    onProgress: (progress) => onProgress?.(progress * 0.8)
  });

  await uploadWithProgress({
    client,
    bucket: THUMBNAIL_BUCKET,
    path: thumbnailPath,
    file: thumbnailFile,
    onProgress: (progress) => onProgress?.(0.8 + progress * 0.15)
  });

  return {
    videoPath,
    thumbnailPath,
    videoUrl: getPublicUrl(client, VIDEO_BUCKET, videoPath),
    thumbnailUrl: getPublicUrl(
      client,
      THUMBNAIL_BUCKET,
      thumbnailPath
    )
  };
}

async function cleanupAssets(client, assets) {
  await Promise.allSettled([
    removeFiles(client, VIDEO_BUCKET, [assets?.videoPath]),
    removeFiles(client, THUMBNAIL_BUCKET, [assets?.thumbnailPath])
  ]);
}

export async function createArtwork({
  client,
  values,
  videoFile,
  thumbnailFile,
  onProgress
}) {
  const metadata = validateMetadata(values);
  validateVideoFile(videoFile, true);

  if (!thumbnailFile) {
    throw new Error("No se pudo generar la miniatura del video.");
  }

  const artworkId = crypto.randomUUID();
  let assets = null;

  try {
    assets = await uploadAssets({
      client,
      artworkId,
      videoFile,
      thumbnailFile,
      onProgress
    });
    onProgress?.(0.96);

    const { data, error } = await client
      .from("artworks")
      .insert({
        id: artworkId,
        title: metadata.title,
        author: metadata.author,
        description: metadata.description,
        video_path: assets.videoPath,
        video_url: assets.videoUrl,
        thumbnail_path: assets.thumbnailPath,
        thumbnail_url: assets.thumbnailUrl,
        slot_id: values.slotId,
        is_active: Boolean(values.isActive)
      })
      .select()
      .single();

    if (error) {
      throw new Error("No se pudo guardar la obra.");
    }

    onProgress?.(1);
    return data;
  } catch (error) {
    await cleanupAssets(client, assets);
    throw error;
  }
}

export async function updateArtwork({
  client,
  artwork,
  values,
  videoFile,
  thumbnailFile,
  onProgress
}) {
  const metadata = validateMetadata(values);
  validateVideoFile(videoFile, false);
  let newAssets = null;

  try {
    if (videoFile) {
      if (!thumbnailFile) {
        throw new Error("No se pudo generar la miniatura del video.");
      }

      newAssets = await uploadAssets({
        client,
        artworkId: artwork.id,
        videoFile,
        thumbnailFile,
        onProgress
      });
    }

    const changes = {
      title: metadata.title,
      author: metadata.author,
      description: metadata.description,
      slot_id: values.slotId,
      is_active: Boolean(values.isActive)
    };

    if (newAssets) {
      Object.assign(changes, {
        video_path: newAssets.videoPath,
        video_url: newAssets.videoUrl,
        thumbnail_path: newAssets.thumbnailPath,
        thumbnail_url: newAssets.thumbnailUrl
      });
    }

    const { data, error } = await client
      .from("artworks")
      .update(changes)
      .eq("id", artwork.id)
      .select()
      .single();

    if (error) {
      throw new Error("No se pudo actualizar la obra.");
    }

    if (newAssets) {
      await Promise.allSettled([
        removeFiles(client, VIDEO_BUCKET, [artwork.video_path]),
        removeFiles(client, THUMBNAIL_BUCKET, [artwork.thumbnail_path])
      ]);
    }

    onProgress?.(1);
    return data;
  } catch (error) {
    await cleanupAssets(client, newAssets);
    throw error;
  }
}

export async function deleteArtwork(client, artwork) {
  const { error } = await client
    .from("artworks")
    .delete()
    .eq("id", artwork.id);

  if (error) {
    throw new Error("No se pudo eliminar la obra.");
  }

  await Promise.all([
    removeFiles(client, VIDEO_BUCKET, [artwork.video_path]),
    removeFiles(client, THUMBNAIL_BUCKET, [artwork.thumbnail_path])
  ]);
}
