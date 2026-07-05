# Tile Battle — 2 Player Realtime Match Game

Node.js + Socket.io backend, plain HTML/CSS/JS frontend. Rendaa players
online-a connect aagi, ஒருத்தருக்கு ஒரு board (8×8) varum. 3 or more same
color tiles-a click panna match aagi score kudukum, adhே அளவுக்கு opponent
board-ku obstacle blocks pogum. 2.5 நிமிடம் timer, முடிந்தப்பறம் highest
score eduthavan win.

## Run panna

```bash
cd tile-battle
npm install
npm start
```

Server `http://localhost:3000`-la start aagum. Rendu browser tab/window
(or rendu vera device same network-la) open panni, "Find Opponent" click
pannunga — automatic-a match aagum.

## Game rules

- Board: 8×8, 6 different gem colors.
- Same color-la connected 3+ tiles click panna அது clear aagும்.
- Score = cleared tile count × 10.
- Ovvoru 3 tiles clear panna 1 obstacle block opponent board-ku pogum
  (obstacle konjo neram andha cell-a block pannum, 6 seconds-la automatic-a
  clear aagi normal tile aagum).
- Match time: 150 seconds (2.5 min). Adjust `GAME_TIME` in `server.js`
  ku venum-na 120–180 range-la maathikalam.
- Time mudinja appuram, yaar score high-o avaru win.

## Files

- `server.js` — matchmaking, board state, match detection (flood fill),
  obstacle logic, timer — ellame server authoritative-a irukum.
- `public/index.html`, `public/style.css`, `public/client.js` — frontend UI.

## Customize

- Board size → `SIZE` in `server.js` (6×6 venum-na `6` set pannunga, andha
  padi client.js/style.css-la `grid-template-columns: repeat(8, ...)` value
  ah `6` maathikanum).
- Colors count → `COLORS` in `server.js` (matching CSS `.color-N` classes
  add pannunga style.css-la, currently 6 irukku).
- Obstacle duration → `OBSTACLE_TIME`.
