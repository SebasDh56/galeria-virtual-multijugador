import { getSupabaseClient } from "./supabase-client.js";

async function readErrorMessage(response, fallback) {
  try {
    const payload = await response.json();
    return payload.message || fallback;
  } catch {
    return fallback;
  }
}

export async function syncServerSession(accessToken) {
  const response = await fetch("/api/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken })
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
        "No se pudo proteger la sesi\u00f3n administrativa."
      )
    );
  }
}

export async function clearServerSession() {
  await fetch("/api/admin/session", { method: "DELETE" });
}

async function verifyAdminRole(client) {
  const { data, error } = await client.rpc("is_admin");

  if (error) {
    throw new Error(
      "No se pudo verificar el permiso administrativo."
    );
  }

  return data === true;
}

export async function signInAdmin(email, password) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.session) {
    throw new Error("Correo o contrase\u00f1a incorrectos.");
  }

  if (!(await verifyAdminRole(client))) {
    await client.auth.signOut({ scope: "local" });
    await clearServerSession();
    throw new Error(
      "Esta cuenta no tiene permiso de administrador."
    );
  }

  await syncServerSession(data.session.access_token);

  return data.user;
}

export async function getCurrentAdmin() {
  const client = await getSupabaseClient();
  const {
    data: { session },
    error: sessionError
  } = await client.auth.getSession();

  if (sessionError) {
    throw new Error("No se pudo leer la sesi\u00f3n actual.");
  }

  if (!session) {
    return null;
  }

  const {
    data: { user },
    error: userError
  } = await client.auth.getUser();

  if (userError || !user) {
    await client.auth.signOut({ scope: "local" });
    await clearServerSession();
    return null;
  }

  if (!(await verifyAdminRole(client))) {
    await client.auth.signOut({ scope: "local" });
    await clearServerSession();
    return null;
  }

  await syncServerSession(session.access_token);

  return { client, user };
}

export function observeAdminSession(client, onSignedOut) {
  const {
    data: { subscription }
  } = client.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" && session?.access_token) {
      syncServerSession(session.access_token).catch(() => {
        onSignedOut();
      });
    }

    if (event === "SIGNED_OUT") {
      onSignedOut();
    }
  });

  return subscription;
}

export async function signOutAdmin(client) {
  await client.auth.signOut({ scope: "local" });
  await clearServerSession();
}
