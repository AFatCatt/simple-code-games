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
    "description": "Collect food, grow your snake, wrap around the edges, and avoid your own body.",
    "controls": "Arrow keys",
    "instructions": "Use the arrow keys to change direction. Collect food to earn points. Crossing an edge brings you back on the opposite side in the same row or column. Hitting your own body ends the run.",
    "image": "assets/images/snake.svg"
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
    "description": "Turn over cards and match every pair in as few moves as possible.",
    "controls": "Click or tap",
    "instructions": "Select two cards to reveal them. Matching cards stay face up; different cards turn back over. Match every pair to finish the board.",
    "image": "assets/images/memory.svg"
  },
  "circle-hop": {
    "title": "Circle Hop",
    "playable": true,
    "leaderboardMetric": "High score",
    "leaderboardOrder": "desc",
    "description": "Time each jump to carry your circle over the next obstacle.",
    "controls": "Space, Up arrow or tap",
    "instructions": "Press Space or tap the game area to jump. Clear the shapes in your path and keep going to increase your score. Touching an obstacle ends the run.",
    "image": "assets/images/circle-hop.svg"
  },
  "medieval-rps": {
    "title": "Medieval RPS",
    "playable": true,
    "leaderboardMetric": "Best winning streak",
    "leaderboardOrder": "desc",
    "description": "Choose Sword, Archer, Shield, Catapult, or Dragon to challenge the computer.",
    "controls": "Click or tap",
    "instructions": "Each choice beats two others and loses to two. Identical choices tie. Sword beats Archer and Catapult. Archer beats Catapult and Dragon. Shield beats Sword and Archer. Catapult beats Shield and Dragon. Dragon beats Sword and Shield.",
    "image": "assets/images/medieval-rps.png"
  }
};

