import { getSupabaseConfig } from "./supabase-client.js";

function encodeObjectPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function getAccessToken(client) {
  const {
    data: { session }
  } = await client.auth.getSession();

  if (!session?.access_token) {
    throw new Error("La sesi\u00f3n administrativa expir\u00f3.");
  }

  return session.access_token;
}

export async function uploadWithProgress({
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
      reject(new Error("Fall\u00f3 la conexi\u00f3n durante la subida."));
    });
    request.send(file);
  });
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
