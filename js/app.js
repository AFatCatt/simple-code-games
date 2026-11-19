/* Small interactions for the structure-and-appearance milestone.
   Game logic, Vue, and saving are intentionally left for later work. */

// Native dialogs keep focus inside the menu and support the Escape key.
const profileDialog = document.querySelector("#profile-dialog");

document.querySelectorAll("[data-open-profile]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (profileDialog && profileDialog.open) {
      profileDialog.close();
      return;
    }

    if (profileDialog) {
      profileDialog.showModal();
    }
  });
});

const gameDialog = document.querySelector("#game-dialog");

function updateContinueButtonState() {
  const continueButton = document.querySelector("#continue-button");
  const newGameButton = document.querySelector("#new-game-button");
  const gameId = localStorage.getItem("simple-code-games-last-game");
  const hasSelectedGame = Boolean(gameId && Object.hasOwn(gameCatalog, gameId));

  if (continueButton) continueButton.disabled = !hasSelectedGame;
  if (newGameButton) newGameButton.disabled = !hasSelectedGame;
}

// Only index.html has a game selection dialog.
if (gameDialog) {
  const instructionsButton = document.querySelector("#show-instructions");
  const instructionsPanel = document.querySelector("#menu-instructions");
  const newGameButton = document.querySelector("#new-game-button");
  const continueButton = document.querySelector("#continue-button");

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
      document.querySelector("#preview-link").href = "game.html?game=" + encodeURIComponent(gameId);

      localStorage.setItem("simple-code-games-last-game", gameId);
      updateContinueButtonState();

      instructionsPanel.hidden = true;
      instructionsButton.setAttribute("aria-expanded", "false");
      gameDialog.showModal();
    });
  });

  if (instructionsButton && instructionsPanel) {
    instructionsButton.addEventListener("click", function () {
      instructionsPanel.hidden = !instructionsPanel.hidden;
      instructionsButton.setAttribute("aria-expanded", String(!instructionsPanel.hidden));
    });
  }

  if (newGameButton) {
    newGameButton.addEventListener("click", function () {
      const gameId = localStorage.getItem("simple-code-games-last-game");
      if (!gameId || !Object.hasOwn(gameCatalog, gameId)) return;
      window.location.href = "game.html?game=" + encodeURIComponent(gameId) + "&start=1";
    });
  }

  if (continueButton) {
    continueButton.addEventListener("click", function () {
      const gameId = localStorage.getItem("simple-code-games-last-game");
      if (!gameId || !Object.hasOwn(gameCatalog, gameId)) return;
      // This project does not save runs yet, so Continue opens a fresh playable run.
      window.location.href = "game.html?game=" + encodeURIComponent(gameId) + "&start=1";
    });
  }
}

updateContinueButtonState();
