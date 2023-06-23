var socket = io();
var keyState = {};
var mapData = [];
var playerList = {};
var playerListOld = {};
var lastTick = performance.now();
var zoom = 3000;
var gameScale = (window.innerWidth + window.innerHeight) / zoom;
var playerId = "";
var fps = 0;

var mouseXOffset = 0;
var mouseYOffset = 0;
var edgeOffset = 400; // Adjust this value to change the distance from the edge for triggering the translation

var cameraX = 0;
var cameraY = 0;
var targetCameraX = 0;
var targetCameraY = 0;
var cameraLerpAmount = 0.1; // Adjust this value to change the smoothness of camera movement

const getFPS = () =>
  new Promise(resolve =>
    requestAnimationFrame(t1 =>
      requestAnimationFrame(t2 => resolve(1000 / (t2 - t1)))
    )
  );

function handleKeyDown(e) {
  keyState[e.keyCode || e.which] = true;
}

function handleKeyUp(e) {
  keyState[e.keyCode || e.which] = false;
}

function handleContextMenu(e) {
  e.preventDefault();
}

function fetchMap() {
  fetch('/map')
    .then(response => response.json())
    .then(data => {
      mapData = data;
    })
    .catch(err => {
      console.log('Fetch Error :-S', err);
    });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  getFPS().then(fps => {
    let fpsRound = Math.round(fps);
    frameRate(fpsRound > 60 ? fpsRound : 60);
  });
}

function playerLerp(id) {
  let player = playerList[id];
  let playerOld = playerListOld[id];
  let tickProgress = (performance.now() - lastTick) / (1000 / 64);
  let lerpX = lerp(playerOld.x, player.x, tickProgress);
  let lerpY = lerp(playerOld.y, player.y, tickProgress);
  return {
    x: lerpX,
    y: lerpY
  };
}

function updateFPS() {
  fps = frameRate();
}

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
    let lerpPos = playerLerp(playerId);
    targetCameraX = (-lerpPos.x * gameScale) + (windowWidth / 2) + mouseXOffset;
    targetCameraY = (-lerpPos.y * gameScale) + (windowHeight / 2) + mouseYOffset;
    cameraX = lerp(cameraX, targetCameraX, cameraLerpAmount);
    cameraY = lerp(cameraY, targetCameraY, cameraLerpAmount);
    translate(cameraX, cameraY);
  }

  scale(gameScale);

  for (const id in playerList) {
    if (playerListOld[id]) {
      let lerpPos = playerLerp(id);
      push();
      fill('green');
      ellipse(lerpPos.x, lerpPos.y, 80, 80);
      pop();
    }
  }

  let highlight = null;

  if (playerList[playerId]) {
    for (const id in mapData) {
      if (mapData[id]) {
        let tile = mapData[id];
        let tileMinX = (tile.minX - playerList[playerId].x) * gameScale + mouseXOffset;
        let tileMaxX = (tile.maxX - playerList[playerId].x) * gameScale + mouseXOffset;
        let tileMinY = (tile.minY - playerList[playerId].y) * gameScale + mouseYOffset;
        let tileMaxY = (tile.maxY - playerList[playerId].y) * gameScale + mouseYOffset;

        if (
          tileMaxX > -windowWidth / 2 && tileMinX < windowWidth / 2 &&
          tileMaxY > -windowHeight / 2 && tileMinY < windowHeight / 2
        ) {
          if (
            mouseX - windowWidth / 2 > tileMinX &&
            mouseY - windowHeight / 2 > tileMinY &&
            mouseX - windowWidth / 2 < tileMaxX &&
            mouseY - windowHeight / 2 < tileMaxY
          ) {
            if (mouseIsPressed === true) {
              socket.emit('remove', tile, id);
            } else {
              highlight = tile;
            }
          } else {
            push();
            stroke(156, 39, 176);
            fill(244, 122, 158);
            noFill();
            strokeWeight(4);
            rect(tile.minX, tile.minY, tile.maxX - tile.minX, tile.maxY - tile.minY);
            pop();
          }
        }
      }
    }
  }

  if (highlight) {
    push();
    stroke(255);
    fill(244, 122, 158);
    noFill();
    strokeWeight(8);
    rect(highlight.minX, highlight.minY, highlight.maxX - highlight.minX, highlight.maxY - highlight.minY);
    pop();
  }
}

function mouseWheel(event) {
  const zoomDelta = event.delta * 3;
  const prevZoom = zoom;
  zoom += zoomDelta;
  zoom = constrain(zoom, 3000, 16000);
  gameScale = (window.innerWidth + window.innerHeight) / zoom;

  const zoomFactor = zoom / prevZoom;
  const dx = (windowWidth / 2 - cameraX) / gameScale;
  const dy = (windowHeight / 2 - cameraY) / gameScale;
  const newCameraX = windowWidth / 2 - dx * zoomFactor * gameScale;
  const newCameraY = windowHeight / 2 - dy * zoomFactor * gameScale;

  targetCameraX += cameraX - newCameraX;
  targetCameraY += cameraY - newCameraY;
  cameraX = targetCameraX;
  cameraY = targetCameraY;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  gameScale = (window.innerWidth + window.innerHeight) / zoom;
}

function mouseMoved() {
  mouseXOffset = 0;
  mouseYOffset = 0;

  // Check if the mouse is near the edges of the canvas
  if (mouseX < edgeOffset) {
    mouseXOffset = edgeOffset - mouseX;
  } else if (mouseX > width - edgeOffset) {
    mouseXOffset = width - edgeOffset - mouseX;
  }

  if (mouseY < edgeOffset) {
    mouseYOffset = edgeOffset - mouseY;
  } else if (mouseY > height - edgeOffset) {
    mouseYOffset = height - edgeOffset - mouseY;
  }
}

// Event listeners
window.addEventListener('keydown', handleKeyDown, true);
window.addEventListener('keyup', handleKeyUp, true);
window.addEventListener('contextmenu', handleContextMenu);
socket.on('id', (id) => {
  playerId = id;
});
socket.on('tick', (playerTickList) => {
  playerListOld = playerList;
  playerList = playerTickList;
  lastTick = performance.now();
});
socket.on('remove', (id) => {
  delete mapData[id];
});
setInterval(updateFPS, 1000);
fetchMap();