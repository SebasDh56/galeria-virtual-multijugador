import { getSupabaseConfig } from "./supabase-client.js";

const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const TUS_VERSION = "1.0.0";
const RETRY_DELAYS = [0, 3000, 5000, 10000];

function encodeObjectPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function encodeTusMetadata(value) {
  return btoa(String(value));
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function getAccessToken(client) {
  const {
    data: { session }
  } = await client.auth.getSession();

  if (!session?.access_token) {
    throw new Error("La sesión administrativa expiró.");
  }

  return session.access_token;
}

function getDirectStorageUrl(supabaseUrl) {
  const parsedUrl = new URL(supabaseUrl);
  const hostParts = parsedUrl.hostname.split(".");

  if (
    hostParts.length >= 3 &&
    hostParts.slice(-2).join(".") === "supabase.co"
  ) {
    return `${parsedUrl.protocol}//${hostParts[0]}.storage.supabase.co`;
  }

  return parsedUrl.origin;
}

function createTusMetadata(bucket, path, file) {
  return [
    ["bucketName", bucket],
    ["objectName", path],
    ["contentType", file.type || "application/octet-stream"],
    ["cacheControl", "3600"]
  ]
    .map(([key, value]) => `${key} ${encodeTusMetadata(value)}`)
    .join(",");
}

async function createResumableUpload({
  endpoint,
  accessToken,
  bucket,
  path,
  file
}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Tus-Resumable": TUS_VERSION,
      "Upload-Length": String(file.size),
      "Upload-Metadata": createTusMetadata(
        bucket,
        path,
        file
      ),
      "x-upsert": "false"
    }
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo iniciar la subida (${response.status}).`
    );
  }

  const location = response.headers.get("location");

  if (!location) {
    throw new Error("Storage no devolvió una dirección de subida.");
  }

  return new URL(location, endpoint).href;
}

async function readUploadOffset(uploadUrl, accessToken) {
  const response = await fetch(uploadUrl, {
    method: "HEAD",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Tus-Resumable": TUS_VERSION
    }
  });

  if (!response.ok) {
    return null;
  }

  const offset = Number(response.headers.get("upload-offset"));
  return Number.isFinite(offset) ? offset : null;
}

async function uploadChunk({
  uploadUrl,
  accessToken,
  chunk,
  offset
}) {
  let lastError = null;

  for (const retryDelay of RETRY_DELAYS) {
    if (retryDelay > 0) {
      await wait(retryDelay);
    }

    try {
      const response = await fetch(uploadUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/offset+octet-stream",
          "Tus-Resumable": TUS_VERSION,
          "Upload-Offset": String(offset)
        },
        body: chunk
      });

      if (response.ok) {
        const nextOffset = Number(
          response.headers.get("upload-offset")
        );
        return Number.isFinite(nextOffset)
          ? nextOffset
          : offset + chunk.size;
      }

      if (response.status < 500 && response.status !== 409) {
        throw new Error(
          `Storage rechazó una parte (${response.status}).`
        );
      }

      lastError = new Error(
        `La subida fue interrumpida (${response.status}).`
      );
    } catch (error) {
      lastError = error;
    }

    const serverOffset = await readUploadOffset(
      uploadUrl,
      accessToken
    );

    if (serverOffset !== null && serverOffset !== offset) {
      return serverOffset;
    }
  }

  throw lastError || new Error("No se pudo subir una parte del video.");
}

async function uploadResumable({
  client,
  bucket,
  path,
  file,
  onProgress
}) {
  const [config, accessToken] = await Promise.all([
    getSupabaseConfig(),
    getAccessToken(client)
  ]);
  const endpoint = `${getDirectStorageUrl(
    config.url
  )}/storage/v1/upload/resumable`;
  const uploadUrl = await createResumableUpload({
    endpoint,
    accessToken,
    bucket,
    path,
    file
  });
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(
      offset,
      Math.min(file.size, offset + TUS_CHUNK_SIZE)
    );
    const nextOffset = await uploadChunk({
      uploadUrl,
      accessToken,
      chunk,
      offset
    });

    if (nextOffset <= offset) {
      throw new Error("Storage no avanzó durante la subida.");
    }

    offset = Math.min(nextOffset, file.size);
    onProgress?.(offset / file.size);
  }
}

async function uploadStandard({
  client,
  bucket,
  path,
  file,
  onProgress
}) {
  const [config, accessToken] = await Promise.all([
    getSupabaseConfig(),
    getAccessToken(client)
  ]);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      `${config.url}/storage/v1/object/${bucket}/${encodeObjectPath(path)}`
    );
    request.setRequestHeader("apikey", config.publishableKey);
    request.setRequestHeader(
      "Authorization",
      `Bearer ${accessToken}`
    );
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }

      reject(new Error("No se pudo subir el archivo a Storage."));
    });
    request.addEventListener("error", () => {
      reject(new Error("Falló la conexión durante la subida."));
    });
    request.send(file);
  });
}

export async function uploadWithProgress(options) {
  if (options.file.size > RESUMABLE_THRESHOLD) {
    await uploadResumable(options);
  } else {
    await uploadStandard(options);
  }

  options.onProgress?.(1);
}

export function getPublicUrl(client, bucket, path) {
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function removeFiles(client, bucket, paths) {
  const validPaths = paths.filter(Boolean);

  if (validPaths.length === 0) {
    return;
  }

  const { error } = await client.storage
    .from(bucket)
    .remove(validPaths);

  if (error) {
    throw new Error("No se pudo eliminar un archivo anterior.");
  }
}

export const UPLOAD_CONFIGURATION = Object.freeze({
  resumableThreshold: RESUMABLE_THRESHOLD,
  chunkSize: TUS_CHUNK_SIZE
});
