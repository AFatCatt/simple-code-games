/* RPS saves describe the CURRENT game. The leaderboard best is stored separately. */
function emptyRPSState() {
  return { version: 1, wins: 0, losses: 0, ties: 0, streak: 0, bestStreak: 0,
    message: "Choose an option to begin." };
}
function validRPSState(state) {
  return Boolean(state && state.version === 1 &&
    ["wins", "losses", "ties", "streak", "bestStreak"].every(key => Number.isSafeInteger(state[key]) && state[key] >= 0) &&
    state.streak <= state.bestStreak && state.bestStreak <= state.wins &&
    typeof state.message === "string" && state.message.length <= 500);
}

function loadMedievalRPS(container, options = {}) {
  const rules = { Sword: ["Archer", "Catapult"], Archer: ["Catapult", "Dragon"],
    Shield: ["Sword", "Archer"], Catapult: ["Shield", "Dragon"], Dragon: ["Sword", "Shield"] };
  const symbols = { Sword: "⚔️", Archer: "🏹", Shield: "🛡️", Catapult: "🪨", Dragon: "🐉" };
  const choices = Object.keys(rules);
  const profile = Profiles.active(); // Capture the owner; never save under a later profile.
  const record = profile ? ArcadeStorage.getRecord(profile.id, "medieval-rps") : null;
  let fresh = Boolean(options.newGame);
  if (fresh && record && !window.confirm("Replace this profile's RPS save? Its leaderboard best will stay.")) fresh = false;
  if (record && !fresh && !validRPSState(record.state)) {
    throw new Error("The RPS save is incompatible. Return to Games and choose New game to replace it.");
  }
  let state = record && !fresh ? record.state : emptyRPSState();
  let revision = record?.revision || 0;
  let dirty = fresh;
  let pending = null;

  container.className = "rps-stage";
  container.innerHTML = `<h2>Choose your champion!</h2>
    <div id="rps-choices"></div>
    <p id="rps-result" role="status"></p><p id="rps-score"></p><p id="rps-streak"></p>
    <p id="rps-save-status" class="small" role="status"></p>
    <button id="retry-save" class="button" type="button" hidden>Retry save</button>`;
  const status = container.querySelector("#rps-save-status");
  const retryButton = container.querySelector("#retry-save");
  const buttonArea = container.querySelector("#rps-choices");
  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.innerHTML = `<span class="rps-symbol" aria-hidden="true">${symbols[choice]}</span><span>${choice}</span>`;
    button.addEventListener("click", () => playRound(choice));
    buttonArea.append(button);
  });
  const setBusy = value => buttonArea.querySelectorAll("button").forEach(button => button.disabled = value);
  function render() {
    container.querySelector("#rps-result").textContent = state.message;
    container.querySelector("#rps-score").textContent = `Wins: ${state.wins} | Losses: ${state.losses} | Ties: ${state.ties}`;
    container.querySelector("#rps-streak").textContent = `Win streak: ${state.streak} | Best streak: ${state.bestStreak}`;
  }
  function persist() {
    if (!profile) {
      dirty = false;
      status.textContent = "Guest game: sign in to save future games and appear on leaderboards.";
      return Promise.resolve();
    }
    if (pending) return pending;
    if (!dirty) return Promise.resolve();
    setBusy(true);
    retryButton.hidden = true;
    status.textContent = "Saving...";
    const snapshot = JSON.parse(JSON.stringify(state));
    const score = state.wins + state.losses + state.ties > 0 ? state.bestStreak : null;
    pending = (async () => {
      await Promise.resolve();
      try {
        if (Profiles.active()?.id !== profile.id) throw new Error("The active profile changed. Reload before playing.");
        revision = await ArcadeStorage.saveGame(profile.id, "medieval-rps", snapshot, score, revision);
        dirty = false;
        status.textContent = "Saved for " + profile.username + ". This is your one RPS save.";
      } catch (error) {
        status.textContent = error.message;
        retryButton.hidden = false;
        throw error;
      } finally { setBusy(false); pending = null; }
    })();
    return pending;
  }
  function playRound(player) {
    if (pending) return;
    const computer = choices[Math.floor(Math.random() * choices.length)];
    let result;
    if (player === computer) {
      state.ties++; state.streak = 0; result = "Same choice. It is a tie!";
    } else if (rules[player].includes(computer)) {
      state.wins++; state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      result = `You win! ${player} beats ${computer}.`;
    } else {
      state.losses++; state.streak = 0; result = `You lose! ${computer} beats ${player}.`;
    }
    state.message = `You chose ${player}. Computer chose ${computer}. ${result}`;
    dirty = true;
    render();
    persist().catch(() => {}); // The visible save-status message reports failures.
  }
  async function beforeLeave() {
    if (pending) await pending;
    if (dirty) await persist();
  }
  async function reset() {
    await beforeLeave();
    if (!window.confirm("Start a new game and replace the current save? Your leaderboard best will stay.")) return;
    state = emptyRPSState(); dirty = true;
    render(); await persist();
  }
  retryButton.addEventListener("click", () => persist().catch(() => {}));
  render();
  status.textContent = profile
    ? (record && !fresh ? "Restored " + profile.username + "'s saved game." : "Every round will save automatically for " + profile.username + ".")
    : "Guest game: scores disappear when you leave. Sign in for saved games and leaderboards.";
  if (fresh) persist().catch(() => {});
  return { beforeLeave, reset };
}
