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

  if (selectedGameId === "medieval-rps" || selectedGameId === "doom") {
    const isDoom = selectedGameId === "doom";
    // Remove the new-game flag so a refresh or profile switch restores the save.
    const newGame = query.get("new") === "1";
    query.delete("new");
    history.replaceState(null, "", location.pathname + "?" + query.toString());
    try {
      const profile = Profiles.active();
      window.currentGame = (isDoom ? loadDoomGame : loadMedievalRPS)(document.querySelector(".game-stage"), { newGame });
      document.querySelector(".game-page-heading .eyebrow").textContent = isDoom ? "Knee-Deep in the Dead · Episode 1" : "Choose your champion";
      document.querySelector(".draft-badge").textContent = "Ready to play";
      document.querySelector(".game-toolbar").textContent = "Profile: " + (profile?.username || "Guest");
      document.querySelector(".instructions-panel h3").textContent = "Controls";
      document.querySelector(".instructions-panel .text-link").textContent = "Game guide →";
      document.querySelector("#save-note").textContent = profile
        ? (isDoom ? "One Doom save for this profile. Autosaves every 10 seconds while alive and when leaving through site links. Save game creates a checkpoint immediately. Wait for Saved before closing. Continue restores it; New game replaces it and keeps your leaderboard best." : "One RPS save for this profile, updated after every round. Continue restores it. New game replaces it and keeps your leaderboard best.")
        : "Guest games are not saved or ranked. Use Profile to sign in or create a local profile.";
      document.querySelector(".game-bottom-bar span").textContent = isDoom ? "Save game pauses play. Click Resume when ready." : "Choose again to play another round.";
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
  if (selectedGameId === "snake" || selectedGameId === "circle-hop") {
    const newGame = query.get("new") === "1";
    query.delete("new");
    history.replaceState(null, "", location.pathname + "?" + query.toString());
    try {
      const profile = Profiles.active();
      window.currentGame = loadCanvasGame(document.querySelector(".game-stage"), selectedGameId, { newGame });
      document.querySelector(".game-page-heading .eyebrow").textContent = selectedGameId === "snake" ? "Collect. Grow. Repeat." : "One more jump";
      document.querySelector(".draft-badge").textContent = "Ready to play";
      document.querySelector(".game-toolbar").textContent = "Profile: " + (profile?.username || "Guest");
      document.querySelector(".instructions-panel h3").textContent = "Controls";
      document.querySelector("#save-note").textContent = profile ? "One save per profile, updated automatically while playing and when paused. Continue restores your run paused. New game replaces it and keeps your leaderboard best." : "Guest games are not saved or ranked. Sign in through Profile before playing.";
      document.querySelector(".instructions-panel .text-link").textContent = "Game guide →";
      document.querySelector(".game-bottom-bar span").textContent = "Pause before taking a break. Saved games resume when you are ready.";
      const button = document.querySelector(".game-bottom-bar button");
      button.disabled = false;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await currentGame.reset(); } catch (error) { showArcadeError(error.message); }
        finally { button.disabled = false; }
      });
    } catch (error) { showArcadeError(error.message); }
  }
  // Pong and Memory Match remain in development.
} else if (selectedGameId) {
  document.querySelector("#game-title").textContent = "Game not found";
  document.querySelector("#game-description").textContent = "Use All games to choose a title.";
}
