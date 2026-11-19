/* Only public profile names and best scores are displayed here. */
const ArcadeLeaderboards = (() => {
  function rank(rows, ascending = false) {
    rows.sort((a, b) => (ascending ? a.score - b.score : b.score - a.score) || a.username.localeCompare(b.username));
    let place = 0;
    rows.forEach((row, i) => {
      if (i === 0 || row.score !== rows[i - 1].score) place = i + 1;
      row.rank = place; // Ties share a rank; the next place skips accordingly.
    });
    return rows;
  }
  function forGame(db, id) {
    if (!gameCatalog[id].leaderboardMetric) return [];
    const rows = [];
    db.profiles.forEach(profile => {
      const record = db.games[profile.id + ":" + id];
      if (record?.version === 1 && Number.isFinite(record.best) && record.best >= 0) {
        rows.push({ id: profile.id, username: profile.username, score: record.best });
      }
    });
    return rank(rows, gameCatalog[id].leaderboardOrder === "asc");
  }
  function overall(db) {
    const totals = new Map();
    Object.keys(gameCatalog).forEach(id => {
      forGame(db, id).forEach(row => {
        const total = totals.get(row.id) || { id: row.id, username: row.username, score: 0, games: 0 };
        total.score += Math.max(0, 11 - row.rank);
        total.games++;
        totals.set(row.id, total);
      });
    });
    return rank(Array.from(totals.values()));
  }
  return { forGame, overall };
})();

(() => {
  const tabs = document.querySelector("#leaderboard-tabs");
  const panel = document.querySelector("#leaderboard-panel");
  const choices = [{ id: "overall", title: "Overall" }, ...Object.entries(gameCatalog).map(([id, game]) => ({ id, title: game.title }))];
  let selected = new URLSearchParams(location.search).get("board") || "overall";
  if (!choices.some(choice => choice.id === selected)) selected = "overall";

  function render() {
    tabs.querySelectorAll("button").forEach(button => {
      const active = button.dataset.board === selected;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", "tab-" + selected);
    panel.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = selected === "overall" ? "Overall standings" : gameCatalog[selected].title;
    const description = document.createElement("p");
    description.className = "muted";
    description.textContent = selected === "overall"
      ? "Each game's top 10 earns placement points: first gets 10, second gets 9, down to tenth with 1. Tied scores share the same rank and points. Overall adds those points across games."
      : (gameCatalog[selected].leaderboardMetric ? "Ranked by " + gameCatalog[selected].leaderboardMetric.toLowerCase() + ". New games keep your best result." : "This game is still in development. Scores will appear after its leaderboard is connected.");
    panel.append(heading, description);
    let rows;
    try {
      const db = ArcadeStorage.read();
      rows = selected === "overall" ? ArcadeLeaderboards.overall(db) : ArcadeLeaderboards.forGame(db, selected);
    } catch (error) { showArcadeError(error.message); return; }
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "leaderboard-empty";
      empty.textContent = selected === "overall" || gameCatalog[selected].playable
        ? (selected === "overall" ? "No scores yet. Sign in and play any supported game to join the board." : "No scores yet. Sign in and play " + gameCatalog[selected].title + " to join the board.")
        : "No scores yet. This board will be available when the game is implemented.";
      panel.append(empty);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "leaderboard-table-wrap";
    const table = document.createElement("table");
    table.className = "leaderboard-table";
    const caption = document.createElement("caption");
    caption.textContent = "Scores saved in this browser";
    table.append(caption);
    const head = table.createTHead().insertRow();
    const labels = selected === "overall" ? ["Rank", "Username", "Points", "Games ranked"] : ["Rank", "Username", gameCatalog[selected].leaderboardMetric];
    labels.forEach(label => {
      const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = label; head.append(cell);
    });
    const body = table.createTBody();
    rows.forEach(row => {
      const tr = body.insertRow();
      const values = selected === "overall" ? [row.rank, row.username, row.score, row.games] : [row.rank, row.username, row.score];
      values.forEach(value => tr.insertCell().textContent = value);
    });
    wrap.append(table); panel.append(wrap);
  }
  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "button leaderboard-tab";
    button.id = "tab-" + choice.id; button.dataset.board = choice.id;
    button.setAttribute("role", "tab"); button.setAttribute("aria-controls", "leaderboard-panel");
    button.textContent = choice.title;
    button.addEventListener("click", () => {
      selected = choice.id;
      history.replaceState(null, "", "?board=" + selected);
      render();
    });
    tabs.append(button);
  });
  tabs.addEventListener("keydown", event => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(tabs.querySelectorAll("button"));
    let index = buttons.indexOf(document.activeElement);
    if (event.key === "Home") index = 0;
    else if (event.key === "End") index = buttons.length - 1;
    else index = (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[index].click(); buttons[index].focus();
  });
  window.addEventListener("arcadedatachange", render);
  window.addEventListener("storage", event => { if (event.key === ArcadeStorage.KEY || event.key === null) render(); });
  render();
})();
