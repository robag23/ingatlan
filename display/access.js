
const DISPLAY_PIN = "7900";
const STORAGE_KEY = "szb_display_access_v2";

function unlockDisplay() {
  document.body.classList.remove("display-locked");
  const gate = document.getElementById("accessGate");
  if (gate) gate.remove();
}

document.addEventListener("DOMContentLoaded", function () {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "ok") {
      unlockDisplay();
      return;
    }
  } catch (e) {
    // Ha a böngésző tiltja a localStorage-ot, attól még működjön a PIN.
  }

  const form = document.getElementById("accessForm");
  const pin = document.getElementById("accessPin");
  const error = document.getElementById("accessError");

  if (!form || !pin) {
    unlockDisplay();
    return;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (pin.value.trim() === DISPLAY_PIN) {
      try {
        localStorage.setItem(STORAGE_KEY, "ok");
      } catch (e) {}
      unlockDisplay();
    } else {
      if (error) error.textContent = "Hibás hozzáférési kód.";
      pin.value = "";
      pin.focus();
    }
  });
});
