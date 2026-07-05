const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ---------- Config ----------
const SIZE = 8;             // board is SIZE x SIZE
const COLORS = 6;           // number of tile colors
const GAME_TIME = 150;      // seconds (2.5 min)
const OBSTACLE_TIME = 6;    // seconds an obstacle blocks a cell

// ---------- Board helpers ----------
function randColor() {
  return Math.floor(Math.random() * COLORS);
}

function createBoard() {
  const board = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) {
      row.push({ type: 'normal', color: randColor(), timer: 0 });
    }
    board.push(row);
  }
  return board;
}

function cloneForClient(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function findGroup(board, r, c) {
  const target = board[r][c];
  if (!target || target.type !== 'normal') return [];
  const color = target.color;
  const visited = new Set();
  const stack = [[r, c]];
  const group = [];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const key = cr + ',' + cc;
    if (visited.has(key)) continue;
    if (cr < 0 || cr >= SIZE || cc < 0 || cc >= SIZE) continue;
    const cell = board[cr][cc];
    if (!cell || cell.type !== 'normal' || cell.color !== color) continue;
    visited.add(key);
    group.push([cr, cc]);
    stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
  }
  return group;
}

function clearGroupAndDrop(board, group) {
  group.forEach(([r, c]) => {
    board[r][c] = null;
  });
  for (let c = 0; c < SIZE; c++) {
    let pointer = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) {
      if (board[r][c] !== null) {
        board[pointer][c] = board[r][c];
        pointer--;
      }
    }
    for (let r = pointer; r >= 0; r--) {
      board[r][c] = { type: 'normal', color: randColor(), timer: 0 };
    }
  }
}

function placeObstacles(board, count) {
  const candidates = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c].type === 'normal') candidates.push([r, c]);
    }
  }
  for (let i = 0; i < count && candidates.length; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const [r, c] = candidates.splice(idx, 1)[0];
    board[r][c] = { type: 'obstacle', color: -1, timer: OBSTACLE_TIME };
  }
}

function tickObstacles(board) {
  let changed = false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      if (cell.type === 'obstacle') {
        cell.timer -= 1;
        if (cell.timer <= 0) {
          board[r][c] = { type: 'normal', color: randColor(), timer: 0 };
          changed = true;
        }
      }
    }
  }
  return changed;
}

// ---------- Room ----------
class Room {
  constructor(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
    this.boards = { [p1.id]: createBoard(), [p2.id]: createBoard() };
    this.scores = { [p1.id]: 0, [p2.id]: 0 };
    this.timeLeft = GAME_TIME;
    this.over = false;
    p1.room = this;
    p2.room = this;
    p1.emit('matchFound', { size: SIZE, totalTime: GAME_TIME });
    p2.emit('matchFound', { size: SIZE, totalTime: GAME_TIME });
    this.interval = setInterval(() => this.tick(), 1000);
    this.broadcast();
  }

  other(socket) {
    return socket.id === this.p1.id ? this.p2 : this.p1;
  }

  tick() {
    if (this.over) return;
    this.timeLeft -= 1;
    tickObstacles(this.boards[this.p1.id]);
    tickObstacles(this.boards[this.p2.id]);
    if (this.timeLeft <= 0) {
      this.endGame();
      return;
    }
    this.broadcast();
  }

  handleClick(socket, r, c) {
    if (this.over) return;
    const board = this.boards[socket.id];
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    if (!board[r][c] || board[r][c].type !== 'normal') return;

    const group = findGroup(board, r, c);
    if (group.length >= 3) {
      this.scores[socket.id] += group.length * 10;
      clearGroupAndDrop(board, group);

      const obstacleCount = Math.floor(group.length / 3);
      if (obstacleCount > 0) {
        const oppSocket = this.other(socket);
        placeObstacles(this.boards[oppSocket.id], obstacleCount);
      }
      this.broadcast();
    }
  }

  broadcast() {
    [this.p1, this.p2].forEach((sock) => {
      const opp = this.other(sock);
      sock.emit('state', {
        board: cloneForClient(this.boards[sock.id]),
        opponentBoard: cloneForClient(this.boards[opp.id]),
        score: this.scores[sock.id],
        opponentScore: this.scores[opp.id],
        timeLeft: this.timeLeft,
      });
    });
  }

  endGame() {
    this.over = true;
    clearInterval(this.interval);
    [this.p1, this.p2].forEach((sock) => {
      const opp = this.other(sock);
      let result = 'draw';
      if (this.scores[sock.id] > this.scores[opp.id]) result = 'win';
      else if (this.scores[sock.id] < this.scores[opp.id]) result = 'lose';
      sock.emit('gameOver', {
        yourScore: this.scores[sock.id],
        opponentScore: this.scores[opp.id],
        result,
      });
    });
  }

  disconnect(socket) {
    if (this.over) return;
    this.over = true;
    clearInterval(this.interval);
    const opp = this.other(socket);
    if (opp && opp.connected) opp.emit('opponentDisconnected');
  }
}

// ---------- Matchmaking ----------
let waiting = null;

io.on('connection', (socket) => {
  socket.on('findMatch', () => {
    if (waiting && waiting.connected && waiting.id !== socket.id) {
      const opponent = waiting;
      waiting = null;
      new Room(opponent, socket); // eslint-disable-line no-new
    } else {
      waiting = socket;
      socket.emit('waiting');
    }
  });

  socket.on('clickTile', ({ row, col }) => {
    if (socket.room) socket.room.handleClick(socket, row, col);
  });

  socket.on('disconnect', () => {
    if (waiting === socket) waiting = null;
    if (socket.room) socket.room.disconnect(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Tile Battle server running at http://localhost:${PORT}`);
});
