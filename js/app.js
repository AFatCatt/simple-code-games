/* Shared profile dialog, navigation and homepage game menus. */
window.arcadeAppReady = (async () => {
  await Profiles.ready;
  const notice = document.createElement("p");
  notice.className = "notice arcade-notice";
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  document.querySelector("main").prepend(notice);
  window.showArcadeError = message => { notice.textContent = message; notice.hidden = false; };
  if (location.protocol === "file:") {
    showArcadeError("Open index.html with Live Server to use profiles, saves and leaderboards reliably.");
  }

  const syncStatus = document.createElement("p");
  syncStatus.className = "small muted"; syncStatus.setAttribute("role","status");
  document.querySelector("main").prepend(syncStatus);
  window.addEventListener("arcadesyncchange", event => { syncStatus.textContent = event.detail.message; });
  window.addEventListener("arcadeauthlost", () => showArcadeError("Your session ended or changed. Reload the page and sign in again."));
  if (Profiles.error) showArcadeError(Profiles.error);
  let active = null;
  try { active = Profiles.active(); } catch (error) { showArcadeError(error.message); }
  const dialog = document.querySelector("#profile-dialog");
  dialog.innerHTML = `
    <form method="dialog" class="dialog-close"><button aria-label="Close profiles">×</button></form>
    <p class="eyebrow">Your corner of the arcade</p><h2 id="profile-title">Your profile</h2>
    <p id="active-profile-name"></p>
    <button id="sign-out" type="button" class="button" hidden>Sign out</button>
    <form id="login-form" class="profile-form">
      <h3>Sign in or switch profile</h3>
      <label for="login-name">Username</label>
      <input id="login-name" name="username" required maxlength="20" autocomplete="username">
      <label for="login-password">Password</label>
      <input id="login-password" name="password" type="password" required maxlength="128" autocomplete="current-password">
      <button class="button primary full-width" type="submit">Sign in</button>
    </form>
    <details class="profile-registration"><summary>Create a new profile</summary>
      <form id="register-form" class="profile-form">
        <label for="register-name">New username</label>
        <input id="register-name" name="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="username" aria-describedby="username-help">
        <p class="small muted" id="username-help">3 to 20 letters, numbers or underscores. Capitalization does not create a different username.</p>
        <label for="register-password">New password (at least 8 characters)</label>
        <input id="register-password" name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password">
        <label for="confirm-password">Confirm password</label>
        <input id="confirm-password" name="confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password">
        <button class="button primary full-width" type="submit">Create profile</button>
      </form>
    </details>
    <p id="profile-message" role="status" aria-live="polite"></p>
    <p class="small muted">Your username and password work on any device. Best scores are shared online. Game checkpoints stay on the device where you play. There is no password recovery in this version.</p>`;

  const message = document.querySelector("#profile-message");
  document.querySelector("#active-profile-name").textContent = active ? "Signed in as " + active.username : "Playing as Guest. Sign in to save and join leaderboards.";
  document.querySelector("#sign-out").hidden = !active;
  document.querySelectorAll("[data-open-profile]").forEach(button => {
    button.textContent = "Profile: " + (active?.username || "Guest");
    button.addEventListener("click", () => {
      window.currentGame?.pause?.();
      message.textContent = "";
      dialog.showModal();
    });
  });
  dialog.addEventListener("close", () => {
    dialog.querySelectorAll('input[type="password"]').forEach(input => input.value = "");
  });

  ArcadeStorage.flushScores().catch(() => {});
  let profileBusy = false;
  async function changeProfile(action) {
    if (profileBusy) return;
    profileBusy = true;
    const buttons = dialog.querySelectorAll("button");
    buttons.forEach(button => button.disabled = true);
    message.textContent = "Please wait...";
    try {
      await window.currentGame?.beforeLeave?.();
      await ArcadeStorage.flushScores().catch(() => {});
      await action();
      location.reload();
    } catch (error) { message.textContent = error.message; }
    finally { profileBusy = false; buttons.forEach(button => button.disabled = false); }
  }
  document.querySelector("#login-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = document.querySelector("#login-name").value;
    const password = document.querySelector("#login-password").value;
    changeProfile(async () => Profiles.setActive(await Profiles.authenticate(name, password)));
  });
  document.querySelector("#register-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = document.querySelector("#register-name").value;
    const password = document.querySelector("#register-password").value;
    if (password !== document.querySelector("#confirm-password").value) {
      message.textContent = "The passwords do not match.";
      return;
    }
    changeProfile(async () => Profiles.setActive(await Profiles.register(name, password)));
  });
  document.querySelector("#sign-out").addEventListener("click", () => changeProfile(() => Profiles.setActive(null)));

  // Await any pending automatic save before following an ordinary site link.
  document.addEventListener("click", async event => {
    const link = event.target.closest("a[href]");
    if (!link || !window.currentGame?.beforeLeave || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        link.target === "_blank" || link.origin !== location.origin) return;
    event.preventDefault();
    try { await window.currentGame.beforeLeave(); location.assign(link.href); }
    catch (error) { showArcadeError(error.message); }
  });

  const gameDialog = document.querySelector("#game-dialog");
  if (!gameDialog) return;
  const instructionsButton = document.querySelector("#show-instructions");
  const instructionsPanel = document.querySelector("#menu-instructions");
  document.querySelectorAll("[data-game]").forEach(tile => {
    tile.addEventListener("click", event => {
      const id = tile.dataset.game;
      if (!Object.hasOwn(gameCatalog, id)) return;
      event.preventDefault();
      const game = gameCatalog[id];
      document.querySelector("#menu-title").textContent = game.title;
      document.querySelector("#menu-description").textContent = game.description;
      document.querySelector("#instructions-text").textContent = game.instructions;
      document.querySelector("#controls-text").textContent = game.controls;
      const newButton = document.querySelector("#new-game-button");
      const continueButton = document.querySelector("#continue-game-button");
      const preview = document.querySelector("#preview-link");
      let saved = false;
      let storageError = "";
      try {
        const profile = Profiles.active();
        const record = profile && game.playable ? ArcadeStorage.getRecord(profile.id, id) : null;
        saved = Boolean(record && (id === "medieval-rps" ? validRPSState(record.state) : id === "doom" ? DoomSave.valid(record.state) : CanvasSaves.valid(id, record.state)));
      } catch (error) { storageError = error.message; }
      newButton.disabled = !game.playable;
      continueButton.disabled = !saved;
      newButton.onclick = () => location.assign("game.html?game=" + id + "&new=1");
      continueButton.onclick = () => location.assign("game.html?game=" + id);
      preview.href = "game.html?game=" + id;
      preview.hidden = Boolean(game.playable);
      gameDialog.querySelector(".menu-status").textContent = game.playable ? "Ready to play" : "In development";
      gameDialog.querySelector(".small.muted").textContent = storageError ||
        (game.playable ? (active ? "One save per profile on this device. Continue restores it. New game can replace it; your leaderboard best stays." : "Guest games are not saved. Sign in through Profile to save your progress.") : "This game is still in development.");
      instructionsPanel.hidden = true;
      instructionsButton.setAttribute("aria-expanded", "false");
      gameDialog.showModal();
    });
  });
  instructionsButton.addEventListener("click", () => {
    instructionsPanel.hidden = !instructionsPanel.hidden;
    instructionsButton.setAttribute("aria-expanded", String(!instructionsPanel.hidden));
  });
})();
