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
    "playable": true,
    "leaderboardMetric": "Best consecutive-goal streak",
    "storageId": "pong-streak",
    "leaderboardOrder": "desc",
    "description": "Play Victoria Mason’s Pong against the computer or another profile online.",
    "controls": "Up/Down arrows or on-screen buttons · Esc to pause",
    "instructions": "Move with Up and Down arrows or hold the on-screen buttons. Score through the white goal in the middle half of the opposite end wall. The rest of the wall bounces the ball. The first player to 10 points wins. Escape pauses or resumes singleplayer. The ball starts slower and gets 1.5 times faster on each paddle hit; walls never speed it up. Your leaderboard score is your best consecutive-goal streak. Conceding a goal resets the current streak, and Next match carries it forward. Restarting an unfinished solo match resets the current streak. Singleplayer has one saved match per profile. Multiplayer lets you host, join a room or find a random opponent. The host controls the left paddle and the guest controls the right. Both modes contribute their best streak to the same leaderboard; their active streaks stay separate.",
    "image": "assets/images/pong.png"
  },
  "memory": {
    "title": "Memory Match",
    "playable": true,
    "leaderboardMetric": "Most pairs in one run",
    "storageId": "memory-run",
    "leaderboardOrder": "desc",
    "description": "Memorize the cards, match pairs, and keep your run alive.",
    "controls": "Click or tap",
    "instructions": "Memorize the face-up cards for up to 60 seconds. Click Start matching whenever you are ready, or wait for the timer to turn the cards over automatically. Matching is untimed: choose two matching cards at a time, and one wrong pair ends the run. Start with 2 cards and add 2 per stage until the board reaches 10 by 10 (100 cards, 50 pairs). Continue after a full board to shuffle another 10 by 10 board while keeping your score. Each matched pair earns one point. Your best run ranks on the leaderboard.",
    "image": "assets/images/memory.png"
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
    "instructions": "Each choice beats two others and loses to two. Identical choices tie. Sword beats Archer and Catapult. Archer beats Catapult and Dragon. Shield beats Sword and Archer. Catapult beats Shield and Dragon. Dragon beats Sword and Shield. Both singleplayer and multiplayer rank your best winning streak. A loss or tie resets the current streak. Each mode keeps its own active streak.",
    "image": "assets/images/medieval-rps.png"
  }
};

