/* All rankings come from the shared database, including for signed-out visitors. */
(async () => {
  await window.arcadeAppReady;
  const tabs = document.querySelector("#leaderboard-tabs"), panel = document.querySelector("#leaderboard-panel");
  const choices = [{id:"overall",title:"Overall"},...Object.entries(gameCatalog).map(([id,game]) => ({id,title:game.title}))];
  let selected = new URLSearchParams(location.search).get("board") || "overall", request = 0;
  if (!choices.some(choice => choice.id === selected)) selected = "overall";
  const refresh = document.createElement("button"); refresh.type="button";refresh.className="button";refresh.textContent="Refresh scores";
  tabs.before(refresh);
  async function render() {
    const token = ++request, board = selected;
    tabs.querySelectorAll("button").forEach(button => { const active=button.dataset.board===board;button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1; });
    panel.setAttribute("aria-labelledby","tab-"+board); panel.setAttribute("aria-busy","true"); panel.replaceChildren();
    const heading=document.createElement("h2");heading.textContent=board==="overall"?"Overall standings":gameCatalog[board].title;
    const description=document.createElement("p");description.className="muted";
    description.textContent=board==="overall"
      ? "Each game's top 10 earns points: first gets 10, second gets 9, down to tenth with 1. Ties share ranks and points. Overall adds those points across games."
      : (gameCatalog[board].leaderboardMetric ? "Ranked by "+gameCatalog[board].leaderboardMetric.toLowerCase()+". New games keep your best result." : "This game is still in development.");
    const status=document.createElement("p");status.setAttribute("role","status");status.textContent="Loading shared scores...";panel.append(heading,description,status);
    try {
      await ArcadeStorage.flushScores().catch(() => {});
      const {data,error}=await ArcadeOnline.requireClient().rpc("arcade_leaderboard",{p_game:board});
      if (error) throw error;
      if (token!==request) return;
      if (!Array.isArray(data) || data.length>50 || !data.every(r=>typeof r.username==="string"&&Number.isSafeInteger(r.score)&&r.score>=0&&Number.isSafeInteger(r.rank)&&r.rank>=1)) throw new Error("Invalid leaderboard response.");
      status.textContent="Updated "+new Date().toLocaleTimeString()+". Top 50 across all devices.";
      if (!data.length) { const empty=document.createElement("p");empty.className="leaderboard-empty";empty.textContent=board==="overall"||gameCatalog[board].playable?"No scores yet. Sign in and play to join this board.":"Scores will appear when this game is implemented.";panel.append(empty);return; }
      const wrap=document.createElement("div");wrap.className="leaderboard-table-wrap";
      const table=document.createElement("table");table.className="leaderboard-table";
      const caption=document.createElement("caption");caption.textContent="Shared online leaderboard";table.append(caption);
      const head=table.createTHead().insertRow();
      (board==="overall"?["Rank","Username","Points","Games ranked"]:["Rank","Username",gameCatalog[board].leaderboardMetric]).forEach(label=>{const th=document.createElement("th");th.scope="col";th.textContent=label;head.append(th)});
      const body=table.createTBody();data.forEach(row=>{const tr=body.insertRow();(board==="overall"?[row.rank,row.username,row.score,row.games]:[row.rank,row.username,row.score]).forEach(value=>tr.insertCell().textContent=value)});
      wrap.append(table);panel.append(wrap);
    } catch (error) {
      if (token===request) status.textContent="Could not load shared scores. "+(ArcadeOnline.error||"Check your connection, then use Refresh scores.");
    } finally { if(token===request)panel.removeAttribute("aria-busy"); }
  }
  choices.forEach(choice=>{
    const button=document.createElement("button");button.type="button";button.className="button leaderboard-tab";
    button.id="tab-"+choice.id;button.dataset.board=choice.id;button.setAttribute("role","tab");button.setAttribute("aria-controls","leaderboard-panel");button.textContent=choice.title;
    button.addEventListener("click",()=>{selected=choice.id;history.replaceState(null,"","?board="+selected);render()});tabs.append(button);
  });
  tabs.addEventListener("keydown",event=>{
    if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;
    event.preventDefault();const buttons=Array.from(tabs.querySelectorAll("button"));let index=buttons.indexOf(document.activeElement);
    if(event.key==="Home")index=0;else if(event.key==="End")index=buttons.length-1;else index=(index+(event.key==="ArrowRight"?1:-1)+buttons.length)%buttons.length;
    buttons[index].click();buttons[index].focus();
  });
  refresh.addEventListener("click",render);
  setInterval(()=>{if(!document.hidden)render()},30000);
  render();
})();
