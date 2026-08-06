const path = require("node:path");

const express = require("express");

const ADMIN_SESSION_COOKIE = "gallery_admin_session";

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie || "";

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const cookieName = cookie.slice(0, separatorIndex).trim();

    if (cookieName === name) {
      return decodeURIComponent(
        cookie.slice(separatorIndex + 1).trim()
      );
    }
  }

  return "";
}

function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  };
}

function setAdminSessionCookie(response, accessToken) {
  response.cookie(ADMIN_SESSION_COOKIE, accessToken, {
    ...getAdminCookieOptions(),
    maxAge: 55 * 60 * 1000
  });
}

function clearAdminSessionCookie(response) {
  response.clearCookie(
    ADMIN_SESSION_COOKIE,
    getAdminCookieOptions()
  );
}

function createAdminRouter({ viewsDirectory }) {
  const router = express.Router();
  const supabaseUrl = String(
    process.env.SUPABASE_URL || ""
  ).replace(/\/+$/, "");
  const supabasePublishableKey = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
  const isSupabaseConfigured = Boolean(
    supabaseUrl && supabasePublishableKey
  );

  async function fetchSupabase(pathname, options = {}) {
    return fetch(`${supabaseUrl}${pathname}`, {
      method: options.method || "GET",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${options.accessToken}`,
        ...options.headers
      },
      body: options.body
    });
  }

  async function validateAdminAccess(accessToken) {
    if (!isSupabaseConfigured || !accessToken) {
      return { isValid: false, user: null };
    }

    try {
      const userResponse = await fetchSupabase(
        "/auth/v1/user",
        { accessToken }
      );

      if (!userResponse.ok) {
        return { isValid: false, user: null };
      }

      const user = await userResponse.json();
      const adminResponse = await fetchSupabase(
        "/rest/v1/rpc/is_admin",
        {
          accessToken,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        }
      );

      if (!adminResponse.ok) {
        return { isValid: false, user: null };
      }

      const isAdmin = await adminResponse.json();

      return {
        isValid: isAdmin === true,
        user: isAdmin === true ? user : null
      };
    } catch (error) {
      console.error(
        "No se pudo validar la sesi\u00f3n administrativa:",
        error.message
      );

      return { isValid: false, user: null };
    }
  }

  async function requireAdminPage(request, response, next) {
    const accessToken = getCookie(
      request,
      ADMIN_SESSION_COOKIE
    );
    const validation = await validateAdminAccess(accessToken);

    if (!validation.isValid) {
      clearAdminSessionCookie(response);
      response.redirect(302, "/admin/login");
      return;
    }

    response.locals.adminUser = validation.user;
    next();
  }

  router.get("/api/config/supabase", (request, response) => {
    response.set("Cache-Control", "no-store");

    if (!isSupabaseConfigured) {
      response.status(503).json({
        configured: false,
        message:
          "Supabase no est\u00e1 configurado en el servidor."
      });
      return;
    }

    response.json({
      configured: true,
      url: supabaseUrl,
      publishableKey: supabasePublishableKey
    });
  });

  router.post("/api/admin/session", async (request, response) => {
    const accessToken = String(
      request.body?.accessToken || ""
    );

    if (
      accessToken.length < 100 ||
      accessToken.length > 8192
    ) {
      response.status(400).json({
        message: "La sesi\u00f3n recibida no es v\u00e1lida."
      });
      return;
    }

    const validation = await validateAdminAccess(accessToken);

    if (!validation.isValid) {
      clearAdminSessionCookie(response);
      response.status(403).json({
        message: "La cuenta no tiene acceso administrativo."
      });
      return;
    }

    setAdminSessionCookie(response, accessToken);
    response.json({
      user: {
        id: validation.user.id,
        email: validation.user.email
      }
    });
  });

  router.delete("/api/admin/session", (request, response) => {
    clearAdminSessionCookie(response);
    response.status(204).end();
  });

  router.get(
    ["/admin/login", "/admin/login/"],
    (request, response) => {
      response.set("Cache-Control", "no-store");
      response.sendFile(
        path.join(viewsDirectory, "admin-login.html")
      );
    }
  );

  router.get(
    ["/admin", "/admin/"],
    requireAdminPage,
    (request, response) => {
      response.set("Cache-Control", "no-store");
      response.sendFile(
        path.join(viewsDirectory, "admin-dashboard.html")
      );
    }
  );

  return router;
}

module.exports = { createAdminRouter };
