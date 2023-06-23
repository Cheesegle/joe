const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const SAT = require('sat');
const RBush = require('rbush');
const world = require('./world');

const port = process.env.PORT || 8080;

app.use(express.static('public'));

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.hp = 100;
    this.velocityX = 0;
    this.velocityY = 0;
    this.speed = 15;
    this.acceleration = 0.5;
    this.deceleration = 0.1;
  }

  updatePosition() {
    this.x += this.velocityX;
    this.y += this.velocityY;
  }

  setVelocity(velocityX, velocityY) {
    this.velocityX = velocityX;
    this.velocityY = velocityY;
  }

  accelerate(accelerationX, accelerationY) {
    this.velocityX += accelerationX;
    this.velocityY += accelerationY;
  }

  decelerate(deceleration) {
    if (this.velocityX > 0) {
      this.velocityX = Math.max(this.velocityX - deceleration, 0);
    } else if (this.velocityX < 0) {
      this.velocityX = Math.min(this.velocityX + deceleration, 0);
    }

    if (this.velocityY > 0) {
      this.velocityY = Math.max(this.velocityY - deceleration, 0);
    } else if (this.velocityY < 0) {
      this.velocityY = Math.min(this.velocityY + deceleration, 0);
    }
  }
}

let tree = new RBush();
let playerList = {};

let tiles = world.generateTiles();
tree.load(tiles);

setInterval(() => {
  for (const id in playerList) {
    const player = playerList[id];
    updatePlayerMovement(player);
    player.updatePosition();
    handleCollision(player);
  }

  const playerTickList = getPlayerTickList(playerList);
  io.emit('tick', playerTickList);
}, 1000 / 64);

function updatePlayerMovement(player) {
  let accelerationX = 0;
  let accelerationY = 0;

  if (player.w) {
    accelerationY -= player.acceleration;
  }
  if (player.a) {
    accelerationX -= player.acceleration;
  }
  if (player.s) {
    accelerationY += player.acceleration;
  }
  if (player.d) {
    accelerationX += player.acceleration;
  }

  // Stop the player if no movement keys are pressed
  if (!player.w && !player.a && !player.s && !player.d) {
    player.decelerate(player.deceleration);
  } else {
    player.accelerate(accelerationX, accelerationY);
  }

  // Limit the player's velocity
  player.velocityX = Math.max(-player.speed, Math.min(player.velocityX, player.speed));
  player.velocityY = Math.max(-player.speed, Math.min(player.velocityY, player.speed));
}

function handleCollision(player) {
  const playerCircle = new SAT.Circle(new SAT.Vector(player.x, player.y), 40);
  const results = tree.search({
    minX: player.x - 50,
    minY: player.y - 50,
    maxX: player.x + 50,
    maxY: player.y + 50,
  });

  if (results.length > 0) {
    for (const result of results) {
      if (result.type === 'tile') {
        handleTileCollision(player, playerCircle, result);
      } else if (result.type === 'bullet') {
        handleBulletCollision(player, playerCircle, result);
      }
    }
  }
}

function handleTileCollision(player, playerCircle, result) {
  const response = new SAT.Response();
  const collided = SAT.testCirclePolygon(playerCircle, result.sat, response);
  if (collided) {
    const overlapV = response.overlapV.clone().scale(-1.5);
    player.velocityX += overlapV.x;
    player.velocityY += overlapV.y;
    player.x += overlapV.x / 2;
    player.y += overlapV.y / 2;
  }
}

function handleBulletCollision(player, playerCircle, result) {
  const response = new SAT.Response();
  const collided = SAT.pointInCircle(new SAT.Vector(result.x, result.y), playerCircle, response);
  if (collided) {
    tree.remove(result);
    player.hp -= 5;
  }
}

function getPlayerTickList(playerList) {
  const playerTickList = {};
  for (const id in playerList) {
    const player = playerList[id];
    playerTickList[id] = {
      x: player.x,
      y: player.y,
      obj: player.sat,
      hp: player.hp,
    };
  }
  return playerTickList;
}

io.on('connection', (socket) => {
  const player = new Player(50 + Math.random() * ((200 * 80) - 50), 50 + Math.random() * ((200 * 80) - 50));
  playerList[socket.id] = player;
  socket.emit('id', socket.id);

  const events = ['w', 'a', 's', 'd', 'up', 'down', 'left', 'right'];
  for (const event of events) {
    socket.on(event, (state) => {
      player[event] = state;
    });
  }

  console.log('MEOWWWWW');
  socket.on('disconnect', () => {
    console.log('grrr');
    delete playerList[socket.id];
  });
  socket.on('remove', (item, id) => {
    io.emit('remove', id);
    tree.remove(item, (a, b) => a.minX === b.minX && a.minY === b.minY);
    delete tiles[id];
  });
});

app.get('/map', (req, res) => {
  res.send(tiles);
});

app.get('/', (req, res) => {
  res.sendFile('index.html');
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});