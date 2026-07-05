const socket = io();

const screens = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  gameover: document.getElementById('gameover'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

const findMatchBtn = document.getElementById('findMatchBtn');
const waitingMsg = document.getElementById('waitingMsg');
const playAgainBtn = document.getElementById('playAgainBtn');
const disconnectBanner = document.getElementById('disconnectBanner');
const refreshBtn = document.getElementById("refreshBtn");

const yourBoardEl = document.getElementById('yourBoard');
const oppBoardEl = document.getElementById('oppBoard');
const yourScoreEl = document.getElementById('yourScore');
const oppScoreEl = document.getElementById('oppScore');
const timeLeftEl = document.getElementById('timeLeft');
const resultTitleEl = document.getElementById('resultTitle');
const finalScoresEl = document.getElementById('finalScores');

findMatchBtn.addEventListener('click', () => {
  socket.emit('findMatch');
  findMatchBtn.disabled = true;
  waitingMsg.classList.remove('hidden');
});

playAgainBtn.addEventListener('click', () => {
  disconnectBanner.classList.add('hidden');
  showScreen('lobby');
  findMatchBtn.disabled = false;
  waitingMsg.classList.add('hidden');
});

refreshBtn.addEventListener("click", () => {
  socket.emit("refreshBoard");
});

socket.on('waiting', () => {
  waitingMsg.classList.remove('hidden');
});

socket.on('matchFound', () => {
  showScreen('game');
  refreshBtn.disabled = false;
  refreshBtn.textContent = "🔄 Refresh (3)";
});

function renderBoard(container, board, interactive) {
  container.innerHTML = '';
  board.forEach((row, r) => {
    row.forEach((cell, c) => {
      const div = document.createElement('div');
      div.classList.add('tile');
      if (cell.type === 'obstacle') {
        div.classList.add('obstacle');
        div.textContent = cell.timer > 0 ? cell.timer : '';
      } else {
        div.classList.add('color-' + cell.color);
      }
      if (interactive) {
        div.addEventListener('click', () => {
          socket.emit('clickTile', { row: r, col: c });
        });
      }
      container.appendChild(div);
    });
  });
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

socket.on('state', (data) => {
  renderBoard(yourBoardEl, data.board, true);
  renderBoard(oppBoardEl, data.opponentBoard, false);
  yourScoreEl.textContent = data.score;
  oppScoreEl.textContent = data.opponentScore;
  timeLeftEl.textContent = formatTime(data.timeLeft);
});

socket.on('gameOver', ({ yourScore, opponentScore, result }) => {
  resultTitleEl.textContent =
    result === 'win' ? 'YOU WIN' : result === 'lose' ? 'YOU LOSE' : 'DRAW';
  finalScoresEl.textContent = `You: ${yourScore}  |  Opponent: ${opponentScore}`;
  showScreen('gameover');
});

socket.on("refreshCount", (count) => {
  refreshBtn.textContent = `🔄 Refresh (${count})`;

  if (count <= 0) {
    refreshBtn.disabled = true;
  }
});

socket.on('opponentDisconnected', () => {
  disconnectBanner.classList.remove('hidden');
});
