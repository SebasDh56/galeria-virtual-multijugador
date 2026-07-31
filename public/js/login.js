const loginForm = document.querySelector("#login-form");
const nicknameInput = document.querySelector("#nickname");
const formError = document.querySelector("#form-error");
const avatarColorInput =
  document.querySelector("#avatar-color");

const NICKNAME_PATTERN = /^[a-zA-ZÀ-ÿ0-9_-]+$/;

function validateNickname(nickname) {
  if (!nickname) {
    return "Debes ingresar un nombre de usuario.";
  }

  if (nickname.length < 3) {
    return "El nombre debe tener al menos 3 caracteres.";
  }

  if (nickname.length > 20) {
    return "El nombre no puede superar los 20 caracteres.";
  }

  if (!NICKNAME_PATTERN.test(nickname)) {
    return "Utiliza únicamente letras, números, guion o guion bajo.";
  }

  return null;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const nickname = nicknameInput.value.trim();
  const validationError = validateNickname(nickname);

  if (validationError) {
    formError.textContent = validationError;
    nicknameInput.focus();
    return;
  }

  formError.textContent = "";

  sessionStorage.setItem("galleryNickname", nickname);
  sessionStorage.setItem(
    "galleryAvatarType",
    loginForm.elements.avatarType.value
  );
  sessionStorage.setItem(
    "galleryAvatarColor",
    avatarColorInput.value
  );

  window.location.href = "/gallery.html";
});
