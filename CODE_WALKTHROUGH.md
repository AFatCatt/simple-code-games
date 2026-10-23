# Code walkthrough

## Start with index.html

The `head` links external CSS and loads scripts with `defer`, which lets the HTML finish parsing before the script runs. The body uses a header, navigation, main area, and footer. Each game tile is a normal anchor with a `data-game` value. Without JavaScript, the link still reaches the shared game page. With JavaScript, `app.js` opens the menu first.

The native `dialog` element creates the overlay. `showModal()` opens it. A form with `method="dialog"` closes it. The browser supports Escape and restores focus to the opener. Instructions are a section whose `hidden` property is toggled by a button.

## Follow the CSS

`css/styles.css` starts with color variables. Change a variable once to update many components. The grid uses three equal columns on wide screens, two below 960 pixels, and one below 560 pixels. `aspect-ratio: 1` keeps each game tile square. Game classes change only the accent and title colors. `:focus-visible` makes keyboard focus visible.

`css/game.css` is loaded only on `game.html`. It controls the preview stage and instructions sidebar. A media query moves the sidebar below the stage on narrower screens.

## Follow one click

1. A visitor clicks Snake in `index.html`.
2. `app.js` reads `data-game="snake"` and looks up `gameCatalog.snake`.
3. `textContent` safely places the title and instructions into the existing dialog.
4. View game layout links to `game.html?game=snake`.
5. `game-loader.js` reads the query parameter with `URLSearchParams`.
6. The loader accepts only an ID in the catalog, then fills the shared layout.

An invalid ID shows Game not found. Missing game IDs show Choose a game. Neither case starts a game or saves data.

## What is a placeholder

Files in `js/games/`, plus `profiles.js` and `storage.js`, contain comments describing future work. They do not run. Disabled Continue, New game, Pause, and Create profile buttons honestly show that these features are unfinished. Vue 3 is planned but is not installed or used yet.

## Changes to make and explain yourselves

- Read each HTML page and personalize the introduction or About copy.
- Adjust a color or spacing rule and explain what changed.
- Review each game's instructions against the proposal.
- Test the layout at phone, tablet, and desktop widths.
- Test Tab, Enter, and Escape in the dialogs.
- Record who made and reviewed each change in TEAM_TASKS.md.
- Replace the report's proposed responsibilities with actual completed contributions before submission.

These are recommended review tasks. They are not recorded as completed.
