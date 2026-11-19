/* Shared display data for the menu and game page.
   Keep each game ID identical to its data-game value in index.html.
   No game code or player data is stored in this object. */
const gameCatalog = {
  "doom": {
    "title": "Original Doom",
    "playable": true,
    "leaderboardMetric": "Most kills in one level",
    "leaderboardOrder": "desc",
    "description": "Play Episode 1 of the original Doom, with profile saves and a local leaderboard.",
    "controls": "WASD or arrows · Mouse or Ctrl to fire · Space to open · Shift to run",
    "instructions": "Explore Knee-Deep in the Dead on Hurt Me Plenty difficulty. Click the game to capture the mouse. Use WASD or arrows to move, mouse or Ctrl to fire, Space for doors, 1–7 for weapons, and Tab for the map. Esc opens or closes the menu and releases the mouse. Use arrows and Enter in menus; Left/Right adjust settings and Backspace goes back. Saves update every 10 seconds while alive, or click Save game. The leaderboard records your most kills in one level.",
    "image": "assets/images/doom.png"
  },
  "snake": {
    "title": "Snake",
    "playable": true,
    "leaderboardMetric": "High score",
    "leaderboardOrder": "desc",
    "description": "Eat apples, wrap around the edges, and collect black bombs to trim your tail.",
    "controls": "Arrow keys",
    "instructions": "Use the arrow keys to move and wrap across edges. Each apple earns one point. A black bomb appears after every 10th apple and trims 1–5 tail squares, keeping at least three. Eat the next apple first and that bomb disappears until the next 10th apple. Bombs keep your earned points. Hitting your body ends the run.",
    "image": "assets/images/snake.png"
  },
  "pong": {
    "title": "Pong",
    "description": "Keep the ball in play against a computer-controlled paddle.",
    "controls": "Up and Down arrows",
    "instructions": "Move your paddle with the Up and Down arrow keys. Return the ball and score when the computer misses. The match target will be set during development.",
    "image": "assets/images/pong.svg"
  },
  "memory": {
    "title": "Memory Match",
    "playable": true,
    "leaderboardMetric": "Most pairs in one run",
    "storageId": "memory-run",
    "leaderboardOrder": "desc",
    "description": "Memorize the cards, match pairs, and keep your run alive.",
    "controls": "Click or tap",
    "instructions": "Cards are shown for four seconds, then turn over. Match two cards at a time. One wrong pair ends the run. Start with 2 cards, then clear 4, 6, 8, 10, 12, 14 and 16. Continue after a full board to shuffle another 16-card board while keeping your score. Each matched pair earns one point. Your best run ranks on the leaderboard.",
    "image": "assets/images/memory.svg"
  },
  "circle-hop": {
    "title": "Circle Hop",
    "playable": true,
    "leaderboardMetric": "High score",
    "leaderboardOrder": "desc",
    "description": "Jump over rectangles, triangles, circles and diamonds as the pace increases.",
    "controls": "Space, Up arrow or tap",
    "instructions": "Press Space, Up arrow or tap the board to jump over rectangles, triangles, circles and diamonds. The game gets slightly faster every 100 points. Touching the visible shape ends the run.",
    "image": "assets/images/circle-hop.png"
  },
  "medieval-rps": {
    "title": "Medieval RPS",
    "playable": true,
    "leaderboardMetric": "Best winning streak",
    "leaderboardOrder": "desc",
    "description": "Choose Sword, Archer, Shield, Catapult, or Dragon to challenge the computer or another profile online.",
    "controls": "Click or tap",
    "instructions": "Each choice beats two others and loses to two. Identical choices tie. Sword beats Archer and Catapult. Archer beats Catapult and Dragon. Shield beats Sword and Archer. Catapult beats Shield and Dragon. Dragon beats Sword and Shield.",
    "image": "assets/images/medieval-rps.png"
  }
};

