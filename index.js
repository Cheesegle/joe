const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const SAT = require('sat');
const RBush = require('rbush');
const world = require('./world')

const port = process.env.PORT || 8080;

app.use(express.static('public'));

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = false;
    this.a = false;
    this.s = false;
    this.d = false;
  }
}

let tree = new RBush();
let playerList = {};

let tiles = world.generateTiles()

tree.load(tiles)


setInterval(function() {
  for (const id in playerList) {
    let player = playerList[id];

    //movement
    if (player.w === true) {
      player.w = false;
      player.y -= 5;
    }
    if (player.a === true) {
      player.a = false;
      player.x -= 5;
    }
    if (player.s === true) {
      player.s = false;
      player.y += 5;
    }
    if (player.d === true) {
      player.d = false;
      player.x += 5;
    }

    //collision
    let playerCircle = new SAT.Circle(new SAT.Vector(player.x, player.y), 40);

    let results = tree.search({
      minX: player.x - 50,
      minY: player.y - 50,
      maxX: player.x + 50,
      maxY: player.y + 50
    });

    if (results.length > 0) {
      for (let i = 0; i < results.length; i++) {
        let response = new SAT.Response();
        let collided = SAT.testCirclePolygon(playerCircle, results[i].sat, response)
        if (collided) {
          let overlapV = response.overlapV.clone().scale(-1.5);
          player.x += overlapV.x;
          player.y += overlapV.y;
        }
      }
    }
  }
  io.emit('tick', playerList)
}, 1000 / 64);

io.on('connection', (socket) => {
  let player = new Player(50 + Math.random() * ((200 * 80) - 50), 50 + Math.random() * ((200 * 80) - 50))
  playerList[socket.id] = player;
  socket.emit('id', socket.id)
  socket.on('w', () => {
    player.w = true;
  });
  socket.on('a', () => {
    player.a = true;
  });
  socket.on('s', () => {
    player.s = true;
  });
  socket.on('d', () => {
    player.d = true;
  });
  console.log('MEOWWWWW');
  socket.on('disconnect', function() {
    console.log('grrr')
    delete playerList[socket.id];
  });
  socket.on('remove', function(item, id) {
    io.emit('remove', id);
    tree.remove(item, (a, b) => {
      return a.minX === b.minX && a.minY === b.minY;
    });
    delete tiles[id];
  });
});

let link = app.get('/map', function(req, res) {
  res.send(tiles)
})

app.get('/', function(req, res) {
  res.sendfile('index.html');
});

server.listen(port, function() {
  console.log(`Listening on port ${port}`);
});