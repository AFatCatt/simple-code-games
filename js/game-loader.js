/* Display the selected game's layout and activate the playable runtime when needed. */
const query = new URLSearchParams(window.location.search);
const selectedGameId = query.get("game");
const stagePreview = document.querySelector("#stage-preview");
const stageMessage = document.querySelector("#stage-message");
const stageCopy = document.querySelector("#stage-copy");
const announcement = document.querySelector("#announcement");
const pauseButton = document.querySelector("#pause-button");
const gameCanvas = document.querySelector("#game-canvas");
const gameState = document.querySelector("#game-state");
const newGameButton = document.querySelector("#new-game-button");

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
  if (stagePreview) {
    stagePreview.src = selectedGame.image;
  }
  document.querySelector("#game-layout").hidden = false;

  if (selectedGameId === "snake") {
    if (stagePreview) stagePreview.hidden = true;
    if (gameCanvas) gameCanvas.hidden = false;
    if (stageMessage) stageMessage.hidden = false;
    if (pauseButton) pauseButton.disabled = false;
    if (newGameButton) newGameButton.disabled = false;
    if (stageCopy) stageCopy.textContent = "Collect food, avoid walls, and keep the snake moving.";
    if (announcement) announcement.textContent = "Press New game to start.";
    if (gameState) gameState.textContent = "Game state: ready";
    if (typeof window.loadSnakeGame === "function") {
      window.loadSnakeGame(document, query.get("start") === "1");
    }
  } else if (selectedGameId === "circle-hop") {
    if (stagePreview) stagePreview.hidden = true;
    if (gameCanvas) {
      gameCanvas.hidden = false;
      gameCanvas.setAttribute("aria-label", "Circle Hop game board");
    }
    if (newGameButton) newGameButton.disabled = false;
    if (typeof window.loadCircleHopGame !== "function") {
      throw new Error("Circle Hop game script was not loaded");
    }
    window.loadCircleHopGame(document, query.get("start") === "1");
  } else {
    if (stagePreview) stagePreview.hidden = false;
    if (gameCanvas) gameCanvas.hidden = true;
    if (pauseButton) pauseButton.disabled = true;
    if (newGameButton) newGameButton.disabled = true;
    if (announcement) announcement.textContent = "Your next game starts here.";
    if (stageCopy) stageCopy.textContent = "This is the planned play area. The game engine has not been added yet.";
    if (gameState) gameState.textContent = "Game state: preview only";
  }

  if (selectedGameId === "doom") {
    document.querySelector("#save-note").textContent =
      "The future Doom runtime will manage its own saves. Profile-specific loading has not been tested or added.";
  }
} else if (selectedGameId) {
  document.querySelector("#game-title").textContent = "Game not found";
  document.querySelector("#game-description").textContent =
    "That game is not in this collection. Use All games to choose one of the six planned titles.";
}
