function loadMedievalRPS(container) {
  // Each choice beats the two choices listed beside it.
  const rules = {
    Sword: ["Archer", "Catapult"],
    Archer: ["Catapult", "Dragon"],
    Shield: ["Sword", "Archer"],
    Catapult: ["Shield", "Dragon"],
    Dragon: ["Sword", "Shield"]
  };

  const choices = Object.keys(rules);

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let streak = 0;
  let bestStreak = 0;

  // Replace the preview image with our game.
  container.className = "rps-stage";

  container.innerHTML = `
    <h2>Choose your champion!</h2>
    <div id="rps-choices"></div>
    <p id="rps-result" role="status">Choose an option to begin.</p>
    <p id="rps-score">Wins: 0 | Losses: 0 | Ties: 0</p>
    <p id="rps-streak">Win streak: 0 | Best streak: 0</p>
  `;

  const buttonArea = container.querySelector("#rps-choices");
  const resultText = container.querySelector("#rps-result");
  const scoreText = container.querySelector("#rps-score");
  const streakText = container.querySelector("#rps-streak");

  // Create one button for each choice.
  choices.forEach(function (choice) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "button";
    const symbols = {
  Sword: "⚔️",
  Archer: "🏹",
  Shield: "🛡️",
  Catapult: "🪨",
  Dragon: "🐉"
};

button.innerHTML = `
  <span class="rps-symbol" aria-hidden="true">${symbols[choice]}</span>
  <span>${choice}</span>
`;

    button.addEventListener("click", function () {
      playRound(choice);
    });

    buttonArea.appendChild(button);
  });

  function playRound(playerChoice) {
    // Pick a random position from 0 through 4.
    const randomIndex = Math.floor(Math.random() * choices.length);
    const computerChoice = choices[randomIndex];

    let message;

    if (playerChoice === computerChoice) {
      ties++;
      streak = 0;
      message = "Same choice. It is a tie!";
    } else if (rules[playerChoice].includes(computerChoice)) {
      wins++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      message = `You win! ${playerChoice} beats ${computerChoice}.`;
    } else {
      losses++;
      streak = 0;
      message = `You lose! ${computerChoice} beats ${playerChoice}.`;
    }

    resultText.textContent =
      `You chose ${playerChoice}. Computer chose ${computerChoice}. ${message}`;

    scoreText.textContent =
      `Wins: ${wins} | Losses: ${losses} | Ties: ${ties}`;

    streakText.textContent =
      `Win streak: ${streak} | Best streak: ${bestStreak}`;
  }
}