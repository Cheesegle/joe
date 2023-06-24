const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const SAT = require('sat');
const RBush = require('rbush');
const world = require('./world');

const port = process.env.PORT || 8080;

app.use(express.static('public'));


mapSize = 20;

class Bullet {
  constructor(x, y, velocityX, velocityY) {
    this.x = x;
    this.y = y;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.speed = 20; // Adjust bullet speed as needed
    this.radius = 15; // Adjust bullet size as needed
    this.range = 100;
    this.playerDamage = 5;
    this.tileDamage = 10;
    this.bounce = false;
  }

  updatePosition() {
    this.x += this.velocityX * this.speed;
    this.y += this.velocityY * this.speed;
  }
}

class Player {
  constructor(x, y) {
    this.x = 50 + (Math.random() * ((mapSize * 80) - 50));
    this.y = 50 + (Math.random() * ((mapSize * 80) - 50));
    this.hp = 100;
    this.velocityX = 0;
    this.velocityY = 0;
    this.speed = 15;
    this.acceleration = 1;
    this.deceleration = 0.5;
    this.bullets = [];
    this.bounce = 1.5;
  }

  shootInDirection(directionX, directionY) {
    // Calculate the magnitude of the direction vector
    const magnitude = Math.sqrt(directionX ** 2 + directionY ** 2);

    if (magnitude !== 0) {
      // Normalize the direction vector
      const normalizedDirectionX = directionX / magnitude;
      const normalizedDirectionY = directionY / magnitude;

      // Create a new bullet with the normalized direction as its velocity
      const bullet = new Bullet(this.x, this.y, normalizedDirectionX, normalizedDirectionY);
      this.bullets.push(bullet);
    }
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

let tileTree = new RBush();
let playerTree = new RBush();
let playerList = {};

let tiles = world.generateTiles(mapSize);
tileTree.load(tiles);

setInterval(() => {
  for (const id in playerList) {
    const player = playerList[id];
    playerTree.remove(player);
    player.updatePosition();
    playerTree.insert(player);
    updatePlayerShooting(player);
    updatePlayerMovement(player);
    handleCollision(player);
    updateBulletPositions(player);
  }

  const playerTickList = getPlayerTickList(playerList);
  io.emit('tick', playerTickList);
}, 1000 / 64);

function updateBulletPositions(player) {
  for (let i = player.bullets.length - 1; i >= 0; i--) {
    const bullet = player.bullets[i];
    bullet.updatePosition();

    bullet.range -= 1;

    if (bullet.range <= 0) {
      player.bullets.splice(i, 1)
    }
  }
}

function updatePlayerShooting(player) {
  const diagonalMultiplier = Math.sqrt(0.5); // Adjust the multiplier as needed for bullet speed

  if (player.up) {
    player.shootInDirection(player.left ? -diagonalMultiplier : player.right ? diagonalMultiplier : 0, -1);
  } else if (player.down) {
    player.shootInDirection(player.left ? -diagonalMultiplier : player.right ? diagonalMultiplier : 0, 1);
  } else {
    player.shootInDirection(player.left ? -1 : player.right ? 1 : 0, 0);
  }
}

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
  const results = tileTree.search({
    minX: player.x - 50,
    minY: player.y - 50,
    maxX: player.x + 50,
    maxY: player.y + 50,
  });

  if (results.length > 0) {
    for (const result of results) {
      handleTileCollision(player, playerCircle, result);
    }
  }
  for (const bullet of player.bullets) {
    handleBulletCollision(player, bullet);
  }
}

function handleBulletCollision(player, bullet) {
  const bulletCircle = new SAT.Circle(new SAT.Vector(bullet.x, bullet.y), bullet.radius);

  // Check collision with tiles
  const results = tileTree.search({
    minX: bullet.x - bullet.radius,
    minY: bullet.y - bullet.radius,
    maxX: bullet.x + bullet.radius,
    maxY: bullet.y + bullet.radius,
  });

  if (results.length > 0) {
    for (const result of results) {
      const response = new SAT.Response();
      const collided = SAT.testCirclePolygon(bulletCircle, result.sat, response);
      if (collided) {
        // Remove the bullet
        const bulletIndex = player.bullets.indexOf(bullet);
        if (bullet.bounce === true) {
          const overlapV = response.overlapV.clone().scale(-1.5);
          bullet.velocityX += overlapV.x;
          bullet.velocityY += overlapV.y;
          bullet.velocityX = Math.max(-1, Math.min(bullet.velocityX, 1));
          bullet.velocityY = Math.max(-1, Math.min(bullet.velocityY, 1));
        } else if (bulletIndex !== -1) {
          player.bullets.splice(bulletIndex, 1);
        }
        if (result.type === 'breakable') {
          result.hp -= bullet.tileDamage;
          io.emit('tileupdate', result.id, result.hp);
          // Check if the tile's hp is <= 0 and remove it if necessary
          if (result.hp <= 0) {
            io.emit('remove', result.id);
            tileTree.remove(result, (a, b) => a.minX === b.minX && a.minY === b.minY);
            delete tiles[result.id];
          }
        }
      }
    }
  }

  // Check collision with players
  const playerCircle = new SAT.Circle(new SAT.Vector(player.x, player.y), 40);
  const potentialCollisions = playerTree.search({
    minX: bullet.x - bullet.radius,
    minY: bullet.y - bullet.radius,
    maxX: bullet.x + bullet.radius,
    maxY: bullet.y + bullet.radius,
  });

  for (const result of potentialCollisions) {
    if (result.id !== player.id) {
      const otherPlayer = playerList[result.id];
      const otherPlayerCircle = new SAT.Circle(new SAT.Vector(otherPlayer.x, otherPlayer.y), 40);
      const response = new SAT.Response();
      const collided = SAT.testCircleCircle(bulletCircle, otherPlayerCircle, response);
      if (collided) {
        // Remove the bullet
        const bulletIndex = player.bullets.indexOf(bullet);
        if (bulletIndex !== -1) {
          player.bullets.splice(bulletIndex, 1);
        }
        otherPlayer.hp -= bullet.playerDamage;
        // Check if the player's HP is <= 0 and remove it if necessary
        if (otherPlayer.hp <= 0) {
          playerList[result.id] = new Player();
        }
        break; // Exit the loop since the bullet can collide with only one player
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
    player.x += overlapV.x / player.bounce;
    player.y += overlapV.y / player.bounce;
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
      bullets: player.bullets
    };
  }
  return playerTickList;
}

io.on('connection', (socket) => {
  const player = new Player();
  playerList[socket.id] = player;
  playerTree.insert(player);
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
  socket.on('click', (item, id) => {
    //on tile click
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