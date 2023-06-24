const SAT = require('sat');
const fastnoise = require('fastnoisejs');

const noise = fastnoise.Create(813);

const scale = 30;

noise.SetNoiseType(fastnoise.Cubic);

function generateTiles(mapSize) {
  let tiles = [];
  let skip = [];
  tiles.push({
    type: 'border',
    sat: new SAT.Box(new SAT.Vector(0, 0), mapSize * 80, 80).toPolygon(),
    minX: 0,
    minY: 0,
    maxX: mapSize * 80,
    maxY: 80,
    hp: mapSize * 80,
    id: tiles.length
  });

  // Generate border tiles for the bottom side
  tiles.push({
    type: 'border',
    sat: new SAT.Box(new SAT.Vector(0, (mapSize - 1) * 80), mapSize * 80, 80).toPolygon(),
    minX: 0,
    minY: (mapSize - 1) * 80,
    maxX: mapSize * 80,
    maxY: mapSize * 80,
    hp: mapSize * 80,
    id: tiles.length
  });

  // Generate border tiles for the left side
  tiles.push({
    type: 'border',
    sat: new SAT.Box(new SAT.Vector(0, 80), 80, (mapSize - 2) * 80).toPolygon(),
    minX: 0,
    minY: 80,
    maxX: 80,
    maxY: mapSize * 80 - 80,
    hp: (mapSize - 2) * 80,
    id: tiles.length
  });

  // Generate border tiles for the right side
  tiles.push({
    type: 'border',
    sat: new SAT.Box(new SAT.Vector((mapSize - 1) * 80, 80), 80, (mapSize - 2) * 80).toPolygon(),
    minX: (mapSize - 1) * 80,
    minY: 80,
    maxX: mapSize * 80,
    maxY: mapSize * 80 - 80,
    hp: (mapSize - 2) * 80,
    id: tiles.length
  });

  for (let y = 1; y < mapSize - 1; y++) {
    for (let x = 1; x < mapSize - 1; x++) {
      if ((noise.GetNoise(x * scale, y * scale) > 0) && !skip.includes(String(x) + String(y))) {
        if (
          (noise.GetNoise((x + 1) * scale, y * scale) > 0) && !skip.includes(String(x + 1) + String(y)) &&
          (noise.GetNoise(x * scale, (y + 1) * scale) > 0) && !skip.includes(String(x) + String(y + 1)) &&
          (noise.GetNoise((x + 1) * scale, (y + 1) * scale) > 0) && !skip.includes(String(x + 1) + String(y + 1))
        ) {
          skip = skip.concat([String(x + 1) + String(y), String(x) + String(y + 1), String(x + 1) + String(y + 1)]);
          let tileWidth, tileHeight;
          if (
            (noise.GetNoise((x + 2) * scale, y * scale) > 0) && !skip.includes(String(x + 2) + String(y)) &&
            (noise.GetNoise((x + 2) * scale, (y + 1) * scale) > 0) && !skip.includes(String(x + 2) + String(y + 1))
          ) {
            tileWidth = 240;
            tileHeight = 160;
            skip = skip.concat([String(x + 2) + String(y), String(x + 2) + String(y + 1)]);
          } else if (
            (noise.GetNoise(x * scale, (y + 2) * scale) > 0) && !skip.includes(String(x) + String(y + 2)) &&
            (noise.GetNoise((x + 1) * scale, (y + 2) * scale) > 0) && !skip.includes(String(x + 1) + String(y + 2))
          ) {
            tileWidth = 160;
            tileHeight = 240;
            skip = skip.concat([String(x) + String(y + 2), String(x + 1) + String(y + 2)]);
          } else {
            tileWidth = 160;
            tileHeight = 160;
          }
          let tileType = 'breakable'
          if(Math.random() < 0.5){
            tileType = 'rock'
          }
          tiles.push({
            type: tileType,
            sat: new SAT.Box(new SAT.Vector(x * 80, y * 80), tileWidth, tileHeight).toPolygon(),
            minX: x * 80,
            minY: y * 80,
            maxX: (x * 80) + tileWidth,
            maxY: (y * 80) + tileHeight,
            hp: tileWidth + tileHeight,
            id: tiles.length
          });
        } else {
          tiles.push({
            type: 'breakable',
            sat: new SAT.Box(new SAT.Vector(x * 80, y * 80), 80, 80).toPolygon(),
            minX: x * 80,
            minY: y * 80,
            maxX: (x * 80) + 80,
            maxY: (y * 80) + 80,
            hp: 160,
            id: tiles.length
          });
        }
      }
    }
  }
  return tiles;
}

exports.generateTiles = generateTiles;