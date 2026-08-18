
const DISPLAY_PIN_HASH = "b7f4fff9b569a0bc87e6b1ef6c0e4c49c08777c9c9aa5eb6c0727edd840a24b8";
const STORAGE_KEY = "szb_display_access";

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join("");
}

function unlockDisplay() {
  document.body.classList.remove("display-locked");
  const gate = document.getElementById("accessGate");
  if(gate) gate.remove();
}

document.addEventListener("DOMContentLoaded", () => {
  if(localStorage.getItem(STORAGE_KEY) === DISPLAY_PIN_HASH) {
    unlockDisplay();
    return;
  }

  const form = document.getElementById("accessForm");
  const pin = document.getElementById("accessPin");
  const error = document.getElementById("accessError");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const h = await sha256(pin.value.trim());
    if(h === DISPLAY_PIN_HASH) {
      localStorage.setItem(STORAGE_KEY, h);
      unlockDisplay();
    } else {
      error.textContent = "Hibás hozzáférési kód.";
      pin.value = "";
      pin.focus();
    }
  });
});
