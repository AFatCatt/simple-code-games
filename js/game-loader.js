/* The URL chooses the game. Only implemented games are started. */
const query = new URLSearchParams(location.search);
const selectedGameId = query.get("game");
const selectedGame = Object.hasOwn(gameCatalog, selectedGameId) ? gameCatalog[selectedGameId] : null;

if (selectedGame) {
  document.title = selectedGame.title + " | Simple Code Games";
  document.querySelector("#game-title").textContent = selectedGame.title;
  document.querySelector("#game-description").textContent = selectedGame.description;
  document.querySelector("#game-instructions").textContent = selectedGame.instructions;
  document.querySelector("#game-controls").textContent = selectedGame.controls;
  document.querySelector("#stage-preview").src = selectedGame.image;
  document.querySelector("#game-layout").hidden = false;

  if (selectedGameId === "medieval-rps") {
    // Remove the new-game flag so a refresh or profile switch restores the save.
    const newGame = query.get("new") === "1";
    query.delete("new");
    history.replaceState(null, "", location.pathname + "?" + query.toString());
    try {
      const profile = Profiles.active();
      window.currentGame = loadMedievalRPS(document.querySelector(".game-stage"), { newGame });
      document.querySelector(".game-page-heading .eyebrow").textContent = "Choose your champion";
      document.querySelector(".draft-badge").textContent = "Ready to play";
      document.querySelector(".game-toolbar").textContent = "Profile: " + (profile?.username || "Guest");
      document.querySelector(".instructions-panel h3").textContent = "Controls";
      document.querySelector(".instructions-panel .text-link").textContent = "Game guide →";
      document.querySelector("#save-note").textContent = profile
        ? "One RPS save for this profile, updated after every round. Continue restores it. New game replaces it and keeps your leaderboard best."
        : "Guest games are not saved or ranked. Use Profile to sign in or create a local profile.";
      document.querySelector(".game-bottom-bar span").textContent = "Choose again to play another round.";
      const button = document.querySelector(".game-bottom-bar button");
      button.disabled = false;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await window.currentGame.reset(); }
        catch (error) { showArcadeError(error.message); }
        finally { button.disabled = false; }
      });
    } catch (error) { showArcadeError(error.message); }
  }
  // Snake and the remaining titles are previews until their engines are added.
} else if (selectedGameId) {
  document.querySelector("#game-title").textContent = "Game not found";
  document.querySelector("#game-description").textContent = "Use All games to choose a title.";
}
