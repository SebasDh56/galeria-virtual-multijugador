import {
  getCurrentAdmin,
  signInAdmin
} from "../services/auth-service.js";

const form = document.querySelector("#admin-login-form");
const emailInput = document.querySelector("#admin-email");
const passwordInput = document.querySelector("#admin-password");
const submitButton = document.querySelector("#admin-login-submit");
const status = document.querySelector("#admin-login-status");

let isSubmitting = false;

function setStatus(message, type = "error") {
  status.textContent = message;
  status.dataset.type = message ? type : "";
}

function setSubmitting(submitting) {
  isSubmitting = submitting;
  submitButton.disabled = submitting;
  submitButton.textContent = submitting
    ? "Verificando..."
    : "Ingresar al panel";
}

async function redirectExistingAdmin() {
  setStatus("Comprobando sesi\u00f3n...", "info");

  try {
    const admin = await getCurrentAdmin();

    if (admin) {
      window.location.replace("/admin");
      return;
    }

    setStatus("");
  } catch (error) {
    setStatus(error.message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting || !form.reportValidity()) {
    return;
  }

  setStatus("");
  setSubmitting(true);

  try {
    await signInAdmin(
      emailInput.value.trim(),
      passwordInput.value
    );
    window.location.replace("/admin");
  } catch (error) {
    setStatus(error.message);
    passwordInput.select();
  } finally {
    setSubmitting(false);
  }
});

redirectExistingAdmin();
