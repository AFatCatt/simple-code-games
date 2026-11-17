function loadSnakeGame(container){
    const canvas = container.querySelector('#snake-canvas'); // searching for game
    const context = canvas.getContext('2d'); // drawing area where snake and food will appear
    const box = 20; // determines size of each square in the game 20x20
    const size = 400; // width and height of canvas
    const scoreDisplay = container.querySelector('#score-display');
    const message = container.querySelector('#announcement');
    const startButton = container.querySelector('#start-button');

    let snake;
    let food; // stores position of food
    let dx; // horizontal movement
    let dy; // vertical movement
    let score;
    let running = false;
    let timer = null;

    function createFood() { //randomly places food
        do {
            food = {
                x: Math.floor(Math.random() * (size / box)) * box,
                y: Math.floor(Math.random() * (size / box)) * box
            };
        } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
}

function draw() {
    context.clearRect(0, 0, size, size); // canvas drawing context clear before re drawing
    context.fillStyle = 'blue'; 
    context.fillRect(food.x, 
        food.y, 
        box, 
        box); // food
        snake.forEach((segment, index) => {


            context.fillStyle = index === 0 ? 'green' : 'lightgreen'; // head is green, body is light green
            context.fillRect(
                segment.x, 
                segment.y, 
                box, 
                box
            ); // draw snake segments
        
        });
}

function endGame() {
    running = false; // stop game from updating
    clearInterval(timer); // stop the game loop
    message.textContent =
    'Game Over! score : ' + score + '. Press start to play again.';
    startButton.textContent = 'Play Again!';

}

function update() {
    //do nothing if not running
    if (!running) return;
    //head position
    const head = { 
        x: snake[0].x + dx,
        y: snake[0].y + dy };
}

const ateFood = head.x === food.x && head.y === food.y; // check if snake ate food 
if (
    head.x < 0||
    head.y < 0 ||
    head.x >= size ||
    head.y >= size ){
        endGame();
        return;
    }
const body = ateFood ? snake : snake.slice (0, -1);

//check if head overlaps body
if ( body.some(segment => segment.x === head.x && segment.y === head.y)) {
    endGame();
    return;
}
// move the snake
snake.unshift(head);

if (ateFood) {
    score++;
    scoreDisplay.textContent = 'Score: ' + score;
    createFood();
} else {
    snake.pop();
    draw();
}

function startGame() { 
    clearInterval(timer); // clear any existing game loop
    snake = [{ x: box * 5, y: box * 5 }];
    // initial direction
    dx = box;
    dy = 0;
    //reset score
    score = 0;
    scoreDisplay.textContent = 'Score: ' + score;
    
    running = true; // game active
    message.textContent = 'Use arrow keys to control the snake ';
    startButton.textContent = 'Restart';
    createFood();
    draw();
    timer = setInterval(update, 100); // game loop

}
function handleKey(event){
    //ignore keyboard if game stopped
    if (!running) return;
    if (event.key === 'ArrowUp' && dy === 0){
        dx= 0;
        dy= -box;
    }
    else if (event.key === 'ArrowDown' && dy === 0){
        dx= 0;
        dy = box;
    }
    else if (event.key === 'ArrowLeft' && dx === 0){
        dx = -box;
        dy = 0;
    }
    else if (event.key === 'ArrowRight' && dx === 0){
        dx = box;
        dy = 0;
    } else { 
        return;}
        event.preventDefault(); // prevent scrolling when arrow keys are pressed
}
startButton.addEventListener('click', startGame); // listen for click
document.addEventListener('keydown', handleKey); // listen for key presses
// clean up
return function cleanup() {
    clearInterval(timer);
    startButton.removeEventListener('click', startGame);
    document.removeEventListener('keydown', handleKey);
}}
