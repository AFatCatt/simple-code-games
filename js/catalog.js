/* Shared display data for the menu and game page.
   Keep each game ID identical to its data-game value in index.html.
   No game code or player data is stored in this object. */
const gameCatalog = {
  "doom": {
    "title": "Original Doom",
    "description": "Explore a classic first-person game through a future browser integration.",
    "controls": "Keyboard and mouse",
    "instructions": "A browser runtime and permitted game files will be added later. Its instructions and save support will be checked during integration.",
    "image": "assets/images/doom.svg"
  },
  "snake": {
    "title": "Snake",
    "description": "Collect food, grow your snake, and avoid the walls and your own tail.",
    "controls": "Arrow keys",
    "instructions": "Use the arrow keys to change direction. Collect food to earn points. Hitting a wall or your own body ends the run.",
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
    "description": "Time each jump to carry your circle over the next obstacle.",
    "controls": "Space or tap",
    "instructions": "Press Space or tap the game area to jump. Clear the shapes in your path and keep going to increase your score. Touching an obstacle ends the run.",
    "image": "assets/images/circle-hop.svg"
  },
  "medieval-rps": {
    "title": "Medieval RPS",
    "description": "Choose Sword, Archer, Shield, Catapult, or Dragon to challenge the computer.",
    "controls": "Click or tap",
    "instructions": "Each choice beats two others and loses to two. Identical choices tie. Sword beats Archer and Catapult. Archer beats Catapult and Dragon. Shield beats Sword and Archer. Catapult beats Shield and Dragon. Dragon beats Sword and Shield.",
    "image": "assets/images/medieval-rps.svg"
  }
};
