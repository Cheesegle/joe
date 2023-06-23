const SAT = require('sat');
const fastnoise = require('fastnoisejs');

const noise = fastnoise.Create(813);

const scale = 30;

noise.SetNoiseType(fastnoise.Cubic);

function generateTiles() {
  let tiles = [];
  let skip = [];
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
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
          tiles.push({
            type: 'tile',
            sat: new SAT.Box(new SAT.Vector(x * 80, y * 80), tileWidth, tileHeight).toPolygon(),
            minX: x * 80,
            minY: y * 80,
            maxX: (x * 80) + tileWidth,
            maxY: (y * 80) + tileHeight,
            hp: tileWidth + tileHeight
          });
        } else {
          tiles.push({
            type: 'tile',
            sat: new SAT.Box(new SAT.Vector(x * 80, y * 80), 80, 80).toPolygon(),
            minX: x * 80,
            minY: y * 80,
            maxX: (x * 80) + 80,
            maxY: (y * 80) + 80,
            hp: 80
          });
        }
      }
    }
  }
  return tiles;
}

exports.generateTiles = generateTiles;