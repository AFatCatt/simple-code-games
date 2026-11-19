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
   //Snake
  if (selectedGameId === "snake"){
    const snakeContainer = document.querySelector("#snake-container");
      snakeContainer.hidden = false;
      loadSnakeGame(snakeContainer);
  } 
   //snake
} else if (selectedGameId) {
  document.querySelector("#game-title").textContent = "Game not found";
  document.querySelector("#game-description").textContent =
    "That game is not in this collection. Use All games to choose one of the six planned titles.";
}
// Start Medieval RPS when that game is selected.
if (selectedGameId === "medieval-rps") {
  const gameArea = document.querySelector(".game-stage");
  loadMedievalRPS(gameArea);

  // Update the old preview labels.
  document.querySelector(".game-page-heading .eyebrow").textContent =
    "Choose your champion";

  document.querySelector(".draft-badge").textContent = "Ready to play";

  document.querySelector("#save-note").textContent =
    "Scores are kept for this visit only. Refreshing resets them.";

  document.querySelector(".instructions-panel h3").textContent =
    "Controls";

  // Hide the unused preview score and Pause controls.
  document.querySelector(".game-toolbar").style.display = "none";

  document.querySelector(".game-bottom-bar span").textContent =
    "Choose again to play another round.";

  // Make the bottom New game button reset the scores.
  const restartButton = document.querySelector(".game-bottom-bar button");
  restartButton.disabled = false;

  restartButton.onclick = function () {
    if (window.confirm("Start a new game and reset your scores?")) {
      loadMedievalRPS(gameArea);
    }
  };
}