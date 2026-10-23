# Simple Code Games

CIS 332 Web Programming, Fall 2026. Team: Ian Catterton and Victoria Mason.

This is the structure and appearance milestone. It is an AI-assisted starter for the team to read, revise, and explain. It does not contain playable games, stored profiles, or save data.

## Open the website

Open `index.html` in a browser, or open this folder in VS Code and run Live Server. No build step or installation is required. Use the same preview URL and port when browser storage is added later.

## Pages and folders

| Path | Purpose |
| --- | --- |
| `index.html` | Home page with six game tiles and a menu dialog |
| `game.html?game=snake` | Shared game layout selected with a query parameter |
| `about.html` | Purpose, team, milestone status, and credits |
| `help.html` | Planned rules and controls for all six games |
| `css/styles.css` | Shared colors, page layout, cards, dialogs, and responsive rules |
| `css/game.css` | Styling used only by the shared gameplay page |
| `js/catalog.js` | Game names, descriptions, instructions, and image paths |
| `js/app.js` | Opens menus and toggles instructions |
| `js/game-loader.js` | Displays the selected game layout |
| `js/profiles.js` | Commented placeholder for future profiles |
| `js/storage.js` | Commented placeholder for future save helpers |
| `js/games/` | One commented placeholder per game |
| `assets/images/` | Six original SVG preview illustrations and a favicon |
| `assets/vendor/` | Reserved location for Vue 3 and a Doom runtime |

The six game IDs are `doom`, `snake`, `pong`, `memory`, `circle-hop`, and `medieval-rps`.

## Publish with GitHub Pages

1. Upload the contents of this folder to a public repository. Keep `index.html` at the root, alongside `css`, `js`, and `assets`.
2. Open the repository's Settings, then Pages.
3. Under Build and deployment, choose Deploy from a branch.
4. Choose `main` and `/(root)`, then Save.
5. Wait for deployment to finish. Copy the live URL shown in Pages into the status report.
6. Open that URL in a signed-out window. Test all pages and each game layout.

All site links use relative paths so they work under a project repository URL.

Official guide: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
Assignment discussion: https://github.com/orgs/community/discussions/160361

## Team review before submission

Read `CODE_WALKTHROUGH.md`, make and explain your own edits, and record actual contributions in `TEAM_TASKS.md`. The assignment asks for readable work that the team understands. Do not submit this starter unchanged as independently authored team code. The contribution split is proposed, not a claim about work already completed.

Both members must submit the final status report. The PDF should be 2-3 pages, state the current project status, give the live website URL, and accurately describe each person's completed work.
