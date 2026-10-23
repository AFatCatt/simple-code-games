/* Small interactions for the structure-and-appearance milestone.
   Game logic, Vue, and saving are intentionally left for later work. */

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
