

// Native dialogs keep focus inside the menu and support the Escape key.
const profileDialog = document.querySelector("#profile-dialog");

document.querySelectorAll("[data-open-profile]").forEach(function (button) {
  button.addEventListener("click", function () {
    profileDialog.showModal();
  });
});

const gameDialog = document.querySelector("#game-dialog");

// Only index.html has a game selection dialog.
if (gameDialog) {
  const instructionsButton = document.querySelector("#show-instructions");
  const instructionsPanel = document.querySelector("#menu-instructions");

  document.querySelectorAll("[data-game]").forEach(function (tile) {
    tile.addEventListener("click", function (event) {
      const gameId = tile.dataset.game;
      const game = gameCatalog[gameId];

      if (!game) return; // Keep the normal link when no matching game exists.
      event.preventDefault();

      document.querySelector("#menu-title").textContent = game.title;
      document.querySelector("#menu-description").textContent = game.description;
      document.querySelector("#instructions-text").textContent = game.instructions;
      document.querySelector("#controls-text").textContent = game.controls;
      document.querySelector("#preview-link").href = "game.html?game=" + gameId;
      // Enable New game for Medieval RPS.
const rpsReady = gameId === "medieval-rps";
const newGameButton = document.querySelector("#new-game-button");
const previewLink = document.querySelector("#preview-link");

newGameButton.disabled = !rpsReady;

newGameButton.onclick = function () {
  window.location.href = "game.html?game=" + gameId;
};

// RPS opens through New game. Unfinished games still show their previews.
previewLink.style.display = rpsReady ? "none" : "";

gameDialog.querySelector(".menu-status").textContent =
  rpsReady ? "Ready to play" : "Gameplay coming later";

gameDialog.querySelector(".small.muted").textContent =
  rpsReady
    ? "Start a fresh game. Scores are kept for this visit only."
    : "This game is still in development.";
      instructionsPanel.hidden = true;
      instructionsButton.setAttribute("aria-expanded", "false");
      gameDialog.showModal();
    });
  });

  instructionsButton.addEventListener("click", function () {
    instructionsPanel.hidden = !instructionsPanel.hidden;
    instructionsButton.setAttribute("aria-expanded", String(!instructionsPanel.hidden));
  });
}
