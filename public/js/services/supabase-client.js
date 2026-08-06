let supabaseClientPromise = null;
let supabaseConfigPromise = null;

async function loadSupabaseConfig() {
  const response = await fetch("/api/config/supabase", {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const config = await response.json();

  if (!response.ok || !config.configured) {
    throw new Error(
      config.message || "Supabase no est\u00e1 configurado."
    );
  }

  return config;
}

export function getSupabaseConfig() {
  if (!supabaseConfigPromise) {
    supabaseConfigPromise = loadSupabaseConfig();
  }

  return supabaseConfigPromise;
}

export function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = getSupabaseConfig().then((config) => {
      if (!window.supabase?.createClient) {
        throw new Error(
          "No se pudo cargar el cliente de Supabase."
        );
      }

      return window.supabase.createClient(
        config.url,
        config.publishableKey,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false
          }
        }
      );
    });
  }

  return supabaseClientPromise;
}
