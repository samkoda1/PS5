import { getBinomialProbability } from './utils.js';

import chroma from 'chroma-js';

const BALL_COLOR = "#2F65A7";     // The color of the balls: [Arboretum Blue](https://brand.umich.edu/design-resources/colors/)
const NUM_BALLS = 10;              // The number of balls to drop
const GRAPH_HEIGHT = 300;          // The maximum height of the graph (in pixels)
const BALL_RADIUS = 10;            // The radius of the balls (in pixels)
const PEG_RADIUS = 3;              // The radius of the pegs (in pixels)
const X_MOVEMENT = 30;             // The horizontal distance between pegs (in pixels)
const Y_MOVEMENT = 20;             // The vertical distance between pegs (in pixels)
const DELAY_BETWEEN_BALLS = 1000;  // Delay between dropping balls (in milliseconds)
const DELAY_BETWEEN_PEGS  = 1000;  // Delay for ball movement between pegs (in milliseconds)
const DELAY_WHEN_DROP     = 1000;  // Delay when ball falls into the slot (in milliseconds)
const PROBABILITY_RIGHT = 0.5;     // The probability a ball goes right

const PADDING = Math.max(PEG_RADIUS, BALL_RADIUS, X_MOVEMENT/2) + 5; // Padding around the SVG element


const svgElement      = document.querySelector('svg');         // The parent SVG container
const numLevelsInput  = document.querySelector('#num-levels');    // Input for the number of levels
const dropBallsButton = document.querySelector('#do-drop');       // Button to drop the balls
const speedInput      = document.querySelector('#speed');         // Input for animation speed

// Requirement
const numBallsInput = document.querySelector('#num-balls');        
const rightwardProbInput = document.querySelector('#rightward-prob'); 

// Arrays for storing drawn elements
const pegs = [];         // A 2D array of pegs (each peg is a circle element)
const actualBars = [];   // Array of actual bars (number of balls that landed)
const expectedBars = []; // Array of expected bars (based on binomial probabilities)

/**
 * Easing functions for smooth animations.
 * easeOutQuad: for movement between pegs.
 */
function easeOutQuad(t) { 
    return t * (2 - t); 
}

/**
 * easeInQuad: for the final drop animation (for bar height change).
 */
function easeInQuad(t) { 
    return t * t; 
}

/**
 * drawBoard() — redraws the entire board.
 * It uses the inputs for levels, number of balls, and rightward probability.
 */
function drawBoard() {
    // Remove all children from the SVG element
    Array.from(svgElement.children).forEach(child => child.remove());

    const NUM_LEVELS = parseInt(numLevelsInput.value);
    // Use user-selected values:
    // (Note: the constants NUM_BALLS and PROBABILITY_RIGHT in your starter code remain unchanged,
    // so here we only read the input values for dynamic behaviors.)
    const userNUM_BALLS = parseInt(numBallsInput.value);
    const userPROBABILITY_RIGHT = parseFloat(rightwardProbInput.value);

    const TOTAL_WIDTH  = (NUM_LEVELS - 1) * X_MOVEMENT + 2 * PADDING;
    const TOTAL_HEIGHT = (NUM_LEVELS - 1) * Y_MOVEMENT + 2 * PADDING + GRAPH_HEIGHT;

    // Calculate BAR_SCALE_FACTOR based on binomial probability
    const MODE = Math.round((NUM_LEVELS - 1) * userPROBABILITY_RIGHT);
    const maxProb = getBinomialProbability(NUM_LEVELS - 1, MODE, userPROBABILITY_RIGHT);
    const BAR_SCALE_FACTOR = 0.5 * GRAPH_HEIGHT / maxProb;

    svgElement.setAttribute('width', TOTAL_WIDTH);
    svgElement.setAttribute('height', TOTAL_HEIGHT);

    const hitCounts = []; // 2D array to track how many balls hit each peg

    // Draw pegs in a triangle formation
    for (let level = 0; level < NUM_LEVELS; level++) {
        const rowHitCounts = [];
        hitCounts.push(rowHitCounts);

        const rowPegs = [];
        pegs.push(rowPegs);

        for (let i = NUM_LEVELS - level - 1; i <= NUM_LEVELS + level - 1; i += 2) {
            rowHitCounts[i] = 0;
            const { x, y } = getGraphicLocation(i, level);
            const circle = createCircle(x, y, PEG_RADIUS, '#FEFEFE', 'none', svgElement);
            // The top peg (level 0) is given the default ball color to represent maximum of the scale.
            if (level === 0) {
                circle.setAttribute('fill', BALL_COLOR);
            }
            rowPegs[i] = circle;
        }
    }

    // Draw the landing slot bars based on the expected binomial distribution
    for (let i = 0; i < 2 * NUM_LEVELS - 1; i += 2) {
        const { x, y } = getGraphicLocation(i, NUM_LEVELS - 1);
        const barY = y + PEG_RADIUS + 2;
        const actualBar = createRect(x - X_MOVEMENT / 2, barY, X_MOVEMENT, 0, BALL_COLOR, 'none', svgElement);
        actualBars.push(actualBar);

        const prob = getBinomialProbability(NUM_LEVELS - 1, Math.floor(i / 2), userPROBABILITY_RIGHT);
        const expectedBar = createRect(x - X_MOVEMENT / 2, barY, X_MOVEMENT, BAR_SCALE_FACTOR * prob, 'rgba(0, 0, 0, 0.1)', BALL_COLOR, svgElement);
        expectedBars.push(expectedBar);
    }

    

    // dropBall(): Drops a single ball from the top and animates it down the board.
    async function dropBall() {
        let row = 0;
        let col = NUM_LEVELS - 1;
        const { x, y } = getGraphicLocation(col, row);


        const ballColor = chroma.random().darken(2 * Math.random() - 1).saturate(2 * Math.random() - 1).hex();
        const circle = createCircle(x, y, BALL_RADIUS, ballColor, ballColor, svgElement);
        circle.setAttribute('opacity', 0.9);

        for (let i = 0; i < NUM_LEVELS - 1; i++) {
            row++;
            if (Math.random() < userPROBABILITY_RIGHT) {
                col++;
            } else {
                col--;
            }
            const { x, y } = getGraphicLocation(col, row);
            // Animate movement between pegs using moveCircleTo with duration adjusted by speed slider.
            await moveCircleTo(circle, x, y, DELAY_BETWEEN_PEGS / parseFloat(speedInput.value));

            // Update peg hit counts and color them based on frequency.
            const peg = pegs[row][col];
            hitCounts[row][col]++;
            const hitRatio = hitCounts[row][col] / userNUM_BALLS;
           


            peg.setAttribute('fill', chroma.scale(['#FEFEFE', '#ff0000']).domain([0, 1])(hitRatio).hex());
        }

        // When the ball reaches the landing slot, run three animations simultaneously:
        // 1. Animate the ball downward by 20 pixels using ease-out.
        // 2. Fade the ball's opacity to 0.
        // 3. Animate the height of the actual bar with ease-in.
        const finalColHitCount = hitCounts[NUM_LEVELS - 1][col];
        const barIndex = Math.floor(col / 2);
        const newBarHeight = BAR_SCALE_FACTOR * finalColHitCount / userNUM_BALLS;

        await Promise.all([
            animateMoveCircleTo(circle, { x: parseFloat(circle.getAttribute('cx')), y: parseFloat(circle.getAttribute('cy')) + 20 },
                                   DELAY_WHEN_DROP / parseFloat(speedInput.value), easeOutQuad),
            animateFadeOut(circle, DELAY_WHEN_DROP / parseFloat(speedInput.value)),
            animateChangeHeightTo(actualBars[barIndex], newBarHeight, DELAY_WHEN_DROP / parseFloat(speedInput.value), easeInQuad)
        ]);

        circle.remove();
    }

   
    async function dropBalls() {
        redrawBoard(); 

        // Requirements
        dropBallsButton.setAttribute('disabled', true);
        numLevelsInput.setAttribute('disabled', true);
        numBallsInput.setAttribute('disabled', true);
        rightwardProbInput.setAttribute('disabled', true);

        const dropBallPromises = [];
        for (let i = 0; i < userNUM_BALLS; i++) {
            const ballDropPromise = dropBall();
            await pause(Math.random() * DELAY_BETWEEN_BALLS / parseFloat(speedInput.value));
            dropBallPromises.push(ballDropPromise);
        }
        await Promise.all(dropBallPromises);

        
        dropBallsButton.removeAttribute('disabled');
        numLevelsInput.removeAttribute('disabled');
        numBallsInput.removeAttribute('disabled');
        rightwardProbInput.removeAttribute('disabled');
    }

    dropBallsButton.addEventListener('click', dropBalls);

  
    function cleanup() {
        expectedBars.forEach(bar => bar.remove());
        expectedBars.splice(0, expectedBars.length);
        actualBars.forEach(bar => bar.remove());
        actualBars.splice(0, actualBars.length);
        pegs.forEach(row => row.forEach(peg => peg.remove()));
        pegs.splice(0, pegs.length);
        dropBallsButton.removeEventListener('click', dropBalls);
    }

    return cleanup;
}



// Animate the height of a rectangle to a new height.
async function changeHeightTo(rect, toHeight, duration) {
    await pause(duration);
    rect.setAttribute('height', toHeight);
}

// Animate movement of a circle to a new location.
async function moveCircleTo(circle, cx, cy, duration) {
    await pause(duration);
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
}


// Requirements
function animateMoveCircleTo(circle, target, duration, easing = (t) => t) {
    const startX = parseFloat(circle.getAttribute('cx'));
    const startY = parseFloat(circle.getAttribute('cy'));
    const deltaX = target.x - startX;
    const deltaY = target.y - startY;
    const startTime = performance.now();

    return new Promise(resolve => {
        function step(currentTime) {
            const t = Math.min((currentTime - startTime) / duration, 1);
            const easedT = easing(t);
            circle.setAttribute('cx', startX + deltaX * easedT);
            circle.setAttribute('cy', startY + deltaY * easedT);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

// Animate fading out a circle's opacity to 0.
function animateFadeOut(circle, duration, easing = (t) => t) {
    const startOpacity = parseFloat(circle.getAttribute('opacity'));
    const startTime = performance.now();

    return new Promise(resolve => {
        function step(currentTime) {
            const t = Math.min((currentTime - startTime) / duration, 1);
            const easedT = easing(t);
            circle.setAttribute('opacity', startOpacity * (1 - easedT));
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

// Animate changing the height of a rectangle.
function animateChangeHeightTo(rect, targetHeight, duration, easing = (t) => t) {
    const startHeight = parseFloat(rect.getAttribute('height')) || 0;
    const deltaHeight = targetHeight - startHeight;
    const startTime = performance.now();

    return new Promise(resolve => {
        function step(currentTime) {
            const t = Math.min((currentTime - startTime) / duration, 1);
            const easedT = easing(t);
            rect.setAttribute('height', startHeight + deltaHeight * easedT);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}



/**
 * Translates a column and row into a pixel location.
 * @param {number} col - The column of the peg (0 is the leftmost peg)
 * @param {number} row - The row of the peg (0 is the topmost peg)
 * @returns {Object} - An object with x and y properties (in pixels)
 */
function getGraphicLocation(col, row) {
    return {
        x: PADDING + col * (X_MOVEMENT / 2),
        y: PADDING + row * Y_MOVEMENT
    };
}

/**
 * Returns a promise that resolves after ms milliseconds.
 * @param {number} ms - Milliseconds to pause.
 */
function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a rectangle and appends it to the parent SVG element.
 */
function createRect(x, y, width, height, fill, stroke, parent) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', stroke);
    parent.append(rect);
    return rect;
}

/**
 * Creates a circle and appends it to the parent SVG element.
 */
function createCircle(cx, cy, r, fill, stroke, parent) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', stroke);
    parent.append(circle);
    return circle;
}

// When any parameter inputs change, redraw the board.
numLevelsInput.addEventListener('input', redrawBoard);
numBallsInput.addEventListener('input', redrawBoard);
rightwardProbInput.addEventListener('input', redrawBoard);

let clearBoard = drawBoard(); // Draw the board initially and store cleanup function

/**
 * Redraws the board by cleaning up the old board and drawing a new one.
 */
function redrawBoard() {
    clearBoard(); // Clean up the old board
    clearBoard = drawBoard(); // Draw the new board and store the cleanup function
}
