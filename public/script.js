var socket = io();

const getFPS = () =>
  new Promise(resolve =>
    requestAnimationFrame(t1 =>
      requestAnimationFrame(t2 => resolve(1000 / (t2 - t1)))
    )
  )

var keyState = {};
window.addEventListener('keydown', function(e) {
  keyState[e.keyCode || e.which] = true;
}, true);
window.addEventListener('keyup', function(e) {
  keyState[e.keyCode || e.which] = false;
}, true);

window.addEventListener("contextmenu", (e) => {
  e.preventDefault()
});

let map = [];

fetch('/map').then(function(response) {
  return response.json();
}).then(function(data) {
  map = data;
}).catch(function(err) {
  console.log('Fetch Error :-S', err);
});

let playerList = {};
let playerListOld = {};
let lastTick = performance.now();
let zoom = 3000;
let gameScale = (window.innerWidth + window.innerHeight) / zoom;
let playerId = "";

socket.on('id', (id) => {
  playerId = id;
});

socket.on('tick', (playerTickList) => {
  playerListOld = playerList;
  playerList = playerTickList;
  lastTick = performance.now()
});

socket.on('remove', (id) => {
  delete map[id];
});

let fps = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  getFPS().then(fps => {
    let fpsRound = Math.round(fps)
    if (fpsRound > 60) {
      frameRate(fpsRound)
    } else {
      frameRate(60)
    }
  });
}

function playerLerp(id) {
  let player = playerList[id]
  let playerOld = playerListOld[id]
  let tickProgress = (performance.now() - lastTick) / (1000 / 64)
  let lerpX = lerp(playerOld.x, player.x, tickProgress)
  let lerpY = lerp(playerOld.y, player.y, tickProgress)
  return {
    x: lerpX,
    y: lerpY
  }
}

setInterval(function() {
  fps = frameRate();
}, 1000);

function draw() {

  const keyEvents = {
    87: 'w',
    65: 'a',
    83: 's',
    68: 'd',
    37: 'up',
    38: 'down',
    39: 'left',
    40: 'right'
  };

  for (const keyCode in keyEvents) {
    const eventName = keyEvents[keyCode];
    socket.emit(eventName, keyState[keyCode]);
  }

  background(0);
  fill(255);
  stroke(0);
  text("FPS: " + fps.toFixed(2), 10, height - 10);

  if (playerListOld[playerId]) {
    let lerpPos = playerLerp(playerId)
    translate((-lerpPos.x * gameScale) + (windowWidth / 2), (-lerpPos.y * gameScale) + (windowHeight / 2));
  }

  scale(gameScale);

  for (const id in playerList) {
    if (playerListOld[id]) {
      let lerpPos = playerLerp(id)
      push()
      // fill('blue')
      // ellipse(playerList[id].x, playerList[id].y, 80, 80);
      fill('green')
      ellipse(lerpPos.x, lerpPos.y, 80, 80);
      pop()
    }
  }

  let highlight = {};

  if (playerList[playerId]) {
    for (const id in map) {
      if (map[id]) {
        let tile = map[id]
        if (
          tile.minY > playerList[playerId].y - ((zoom / (windowWidth + windowHeight)) * (windowHeight / 2)) - 240 &&
          tile.minY < playerList[playerId].y + ((zoom / (windowWidth + windowHeight)) * (windowHeight / 2)) + 240 &&
          tile.minX > playerList[playerId].x - ((zoom / (windowWidth + windowHeight)) * (windowWidth / 2)) - 240 &&
          tile.minX < playerList[playerId].x + ((zoom / (windowWidth + windowHeight)) * (windowWidth / 2)) + 240
        ) {
          if (
            mouseX - windowWidth / 2 > (tile.minX - playerList[playerId].x) * gameScale &&
            mouseY - windowHeight / 2 > (tile.minY - playerList[playerId].y) * gameScale &&
            mouseX - windowWidth / 2 < (tile.maxX - playerList[playerId].x) * gameScale &&
            mouseY - windowHeight / 2 < (tile.maxY - playerList[playerId].y) * gameScale
          ) {
            if (mouseIsPressed === true) {
              socket.emit('remove', tile, id)
            } else {
              highlight = tile;
            }
          } else {
            push()
            stroke(156, 39, 176);
            fill(244, 122, 158);
            noFill();
            strokeWeight(4);
            rect(tile.minX, tile.minY, tile.maxX - tile.minX, tile.maxY - tile.minY);
            pop()
          }
        }
      }
    }
  }

  if (highlight) {
    push()
    stroke(255);
    fill(244, 122, 158);
    noFill();
    strokeWeight(8);
    rect(highlight.minX, highlight.minY, highlight.maxX - highlight.minX, highlight.maxY - highlight.minY);
    pop()
  }


}

function mouseWheel(event) {
  zoom += event.delta * 3;
  zoom = constrain(zoom, 3000, 16000);
  gameScale = (window.innerWidth + window.innerHeight) / zoom;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  gameScale = (window.innerWidth + window.innerHeight) / zoom;
}