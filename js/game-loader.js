/* Display the selected game's layout.
   Example URL: game.html?game=snake
   This file does not start a game engine yet. */
const query = new URLSearchParams(window.location.search);
const selectedGameId = query.get("game");

// Only accept IDs that are explicitly listed in our own catalog.
const selectedGame = Object.hasOwn(gameCatalog, selectedGameId)
  ? gameCatalog[selectedGameId]
  : null;

if (selectedGame) {
  document.title = selectedGame.title + " | Simple Code Games";
  document.querySelector("#game-title").textContent = selectedGame.title;
  document.querySelector("#game-description").textContent = selectedGame.description;
  document.querySelector("#game-instructions").textContent = selectedGame.instructions;
  document.querySelector("#game-controls").textContent = selectedGame.controls;
  document.querySelector("#stage-preview").src = selectedGame.image;
  document.querySelector("#game-layout").hidden = false;

  if (selectedGameId === "doom") {
    document.querySelector("#save-note").textContent =
      "The future Doom runtime will manage its own saves. Profile-specific loading has not been tested or added.";
  }
} else if (selectedGameId) {
  document.querySelector("#game-title").textContent = "Game not found";
  document.querySelector("#game-description").textContent =
    "That game is not in this collection. Use All games to choose one of the six planned titles.";
}
