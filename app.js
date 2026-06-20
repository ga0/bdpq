const letters = ["b", "d", "p", "q"];
const INITIAL_TIME_LIMIT = 10;
const MIN_TIME_LIMIT = 1;
const CORRECTS_TO_SPEED_UP = 10;
const WRONGS_TO_SLOW_DOWN = 3;

const cardThemes = [
  "linear-gradient(160deg, #232946 0%, #8357c5 100%)",
  "linear-gradient(160deg, #184e4b 0%, #2f8f83 100%)",
  "linear-gradient(160deg, #3a255f 0%, #d64f86 100%)",
  "linear-gradient(160deg, #19315f 0%, #3977c5 100%)",
  "linear-gradient(160deg, #4a2b18 0%, #b65f36 100%)",
];

const shardClips = [
  "polygon(0 0, 52% 0, 24% 46%, 0 64%)",
  "polygon(52% 0, 100% 0, 78% 42%, 24% 46%)",
  "polygon(0 64%, 24% 46%, 42% 100%, 0 100%)",
  "polygon(24% 46%, 78% 42%, 62% 100%, 42% 100%)",
  "polygon(78% 42%, 100% 0, 100% 58%, 62% 100%)",
  "polygon(62% 100%, 100% 58%, 100% 100%)",
  "polygon(12% 16%, 70% 18%, 50% 58%, 8% 80%)",
  "polygon(44% 52%, 92% 22%, 84% 90%, 34% 94%)",
];

const scoreEl = document.querySelector("#score");
const roundEl = document.querySelector("#round");
const limitEl = document.querySelector("#limit");
const gameShell = document.querySelector(".game-shell");
const letterCard = document.querySelector(".letter-card");
const letterDisplay = document.querySelector("#letterDisplay");
const feedbackEl = document.querySelector("#feedback");
const timerTrack = document.querySelector("#timerTrack");
const timerFill = document.querySelector("#timerFill");
const speedHintEl = document.querySelector("#speedHint");
const mistakeHintEl = document.querySelector("#mistakeHint");
const comboBadge = document.querySelector("#comboBadge");
const comboCountEl = document.querySelector("#comboCount");
const bestScoreEl = document.querySelector("#bestScore");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const choiceButtons = [...document.querySelectorAll(".choice")];

let currentLetter = "b";
let score = 0;
let completed = 0;
let timeLimit = INITIAL_TIME_LIMIT;
let correctStreak = 0;
let wrongStreak = 0;
let comboStreak = 0;
let timerId = null;
let roundStartedAt = 0;
let roundDeadlineAt = 0;
let roundDurationMs = INITIAL_TIME_LIMIT * 1000;
let roundRemainingMs = roundDurationMs;
let acceptingAnswer = false;
let isPaused = true;
let pausedMode = "question";
let currentThemeIndex = -1;
let bestScore = Number(localStorage.getItem("bdpq-best-score") || 0);
let audioContext = null;

bestScoreEl.textContent = bestScore;

function getTimeLimit() {
  return timeLimit;
}

function pickNextLetter() {
  const candidates = letters.filter((letter) => letter !== currentLetter);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickNextTheme() {
  const candidates = cardThemes
    .map((theme, index) => ({ theme, index }))
    .filter(({ index }) => index !== currentThemeIndex);
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  currentThemeIndex = next.index;
  return next.theme;
}

function updateStats() {
  scoreEl.textContent = score;
  roundEl.textContent = completed + 1;
  limitEl.textContent = timeLimit;
  speedHintEl.textContent =
    timeLimit === MIN_TIME_LIMIT ? "已经最快啦" : `连对 ${correctStreak}/${CORRECTS_TO_SPEED_UP}`;
  mistakeHintEl.textContent = `连错 ${wrongStreak}/${WRONGS_TO_SLOW_DOWN}`;
  comboCountEl.textContent = comboStreak;
  comboBadge.className = "combo-badge";

  if (comboStreak >= 10) {
    comboBadge.classList.add("combo-mega");
  } else if (comboStreak >= 6) {
    comboBadge.classList.add("combo-hot");
  } else if (comboStreak >= 3) {
    comboBadge.classList.add("combo-warm");
  }

  bestScoreEl.textContent = bestScore;
}

function playSound(kind) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;
  const patterns = {
    correct: [
      [523.25, 0, 0.1],
      [659.25, 0.09, 0.11],
      [783.99, 0.18, 0.16],
    ],
    level: [
      [659.25, 0, 0.09],
      [783.99, 0.08, 0.1],
      [987.77, 0.17, 0.18],
    ],
    wrong: [
      [196, 0, 0.12],
      [146.83, 0.11, 0.16],
    ],
  };

  patterns[kind].forEach(([frequency, delay, duration]) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = kind === "wrong" ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(kind === "wrong" ? 0.05 : 0.08, now + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + 0.03);
  });
}

function setButtonsDisabled(disabled) {
  choiceButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function clearButtonStates() {
  choiceButtons.forEach((button) => {
    button.classList.remove("is-correct", "is-wrong");
  });
}

function updatePauseButton() {
  pauseButton.textContent = isPaused ? "▶" : "Ⅱ";
  pauseButton.setAttribute("aria-label", isPaused ? "继续" : "暂停");
  pauseButton.setAttribute("title", isPaused ? "继续" : "暂停");
  pauseButton.setAttribute("aria-pressed", String(isPaused));
  gameShell.classList.toggle("is-paused", isPaused);
  letterCard.classList.toggle("is-paused", isPaused);
}

function startTimer(remainingMs) {
  window.clearTimeout(timerId);

  roundRemainingMs = Math.max(0, remainingMs);
  roundDeadlineAt = Date.now() + roundRemainingMs;
  roundStartedAt = roundDeadlineAt - roundDurationMs;

  const fillRatio = roundDurationMs > 0 ? roundRemainingMs / roundDurationMs : 0;
  timerFill.style.transition = "none";
  timerFill.style.transform = `scaleX(${fillRatio})`;
  void timerFill.offsetWidth;

  window.requestAnimationFrame(() => {
    timerFill.style.transition = `transform ${roundRemainingMs}ms linear`;
    timerFill.style.transform = "scaleX(0)";
  });

  timerId = window.setTimeout(() => finishRound(null), roundRemainingMs);
}

function freezeTimer() {
  window.clearTimeout(timerId);
  roundRemainingMs = Math.max(0, roundDeadlineAt - Date.now());
  const fillRatio = roundDurationMs > 0 ? roundRemainingMs / roundDurationMs : 0;

  timerFill.style.transition = "none";
  timerFill.style.transform = `scaleX(${fillRatio})`;
}

function flashMistake({ timeout = false } = {}) {
  document.body.classList.remove("mistake-flash");
  void document.body.offsetWidth;
  document.body.classList.add("mistake-flash");

  if (timeout) {
    timerTrack.classList.remove("timeout-flash");
    void timerTrack.offsetWidth;
    timerTrack.classList.add("timeout-flash");
  }

  window.setTimeout(() => {
    document.body.classList.remove("mistake-flash");
    timerTrack.classList.remove("timeout-flash");
  }, 720);
}

function shatterLetter() {
  letterDisplay.classList.add("shattering");

  shardClips.forEach((clip, index) => {
    const shard = document.createElement("span");
    const angle = (Math.PI * 2 * index) / shardClips.length - Math.PI / 2;
    const distance = 90 + (index % 3) * 24;

    shard.className = "letter-shard";
    shard.textContent = currentLetter;
    shard.style.setProperty("--clip", clip);
    shard.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    shard.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    shard.style.setProperty("--r", `${index % 2 === 0 ? 32 + index * 9 : -36 - index * 8}deg`);
    shard.style.setProperty("--delay", `${index * 18}ms`);

    letterDisplay.append(shard);
  });
}

function recordWrongStreak() {
  correctStreak = 0;
  comboStreak = 0;
  wrongStreak += 1;

  if (wrongStreak < WRONGS_TO_SLOW_DOWN) {
    return "";
  }

  const previousTimeLimit = timeLimit;
  timeLimit = Math.min(INITIAL_TIME_LIMIT, timeLimit + 1);
  wrongStreak = 0;

  return timeLimit > previousTimeLimit ? `慢一点也没关系，回到 ${timeLimit} 秒` : "现在已经是10秒，先稳住";
}

function startRound({ paused = false } = {}) {
  window.clearTimeout(timerId);
  clearButtonStates();

  currentLetter = completed === 0 ? letters[Math.floor(Math.random() * letters.length)] : pickNextLetter();
  roundDurationMs = getTimeLimit() * 1000;
  roundRemainingMs = roundDurationMs;
  acceptingAnswer = true;
  isPaused = paused;
  pausedMode = paused ? "question" : "";

  letterDisplay.textContent = currentLetter;
  letterDisplay.classList.remove("shattering");
  letterDisplay.style.background = pickNextTheme();
  letterDisplay.classList.remove("pop");
  window.requestAnimationFrame(() => letterDisplay.classList.add("pop"));
  feedbackEl.textContent = paused ? "点继续开始" : "看清方向，再点按钮";
  feedbackEl.className = "feedback";
  setButtonsDisabled(paused);
  updatePauseButton();
  updateStats();

  timerFill.style.transition = "none";
  timerFill.style.transform = "scaleX(1)";

  if (!paused) {
    startTimer(roundDurationMs);
  }
}

function finishRound(answer) {
  if (!acceptingAnswer || isPaused) return;

  acceptingAnswer = false;
  window.clearTimeout(timerId);
  setButtonsDisabled(true);

  const isCorrect = answer === currentLetter;
  const correctButton = document.querySelector(`[data-choice="${currentLetter}"]`);
  correctButton?.classList.add("is-correct");

  if (answer && !isCorrect) {
    document.querySelector(`[data-choice="${answer}"]`)?.classList.add("is-wrong");
  }

  const remainingRatio = roundDurationMs > 0 ? Math.max(0, roundDeadlineAt - Date.now()) / roundDurationMs : 0;
  timerFill.style.transition = "none";
  timerFill.style.transform = `scaleX(${remainingRatio})`;

  if (isCorrect) {
    score += 1;
    bestScore = Math.max(bestScore, score);
    localStorage.setItem("bdpq-best-score", String(bestScore));
    correctStreak += 1;
    comboStreak += 1;
    wrongStreak = 0;
    shatterLetter();

    if (correctStreak >= CORRECTS_TO_SPEED_UP) {
      timeLimit = Math.max(MIN_TIME_LIMIT, timeLimit - 1);
      correctStreak = 0;
      feedbackEl.textContent = timeLimit === MIN_TIME_LIMIT ? "连对10次，已经最快啦！" : `连对10次，提速到 ${timeLimit} 秒！`;
      playSound("level");
    } else {
      feedbackEl.textContent = "答对了，真棒！";
      playSound("correct");
    }

    feedbackEl.className = "feedback correct";
  } else if (answer === null) {
    flashMistake({ timeout: true });
    feedbackEl.textContent = recordWrongStreak() || `时间到，答案是 ${currentLetter.toUpperCase()}`;
    feedbackEl.className = "feedback wrong";
    playSound("wrong");
  } else {
    flashMistake();
    feedbackEl.textContent = recordWrongStreak() || `这次是 ${currentLetter.toUpperCase()}，下一题继续`;
    feedbackEl.className = "feedback wrong";
    playSound("wrong");
  }

  completed += 1;
  updateStats();
  timerId = window.setTimeout(() => startRound(), isCorrect ? 850 : 950);
}

function resetGame() {
  window.clearTimeout(timerId);
  score = 0;
  completed = 0;
  timeLimit = INITIAL_TIME_LIMIT;
  correctStreak = 0;
  wrongStreak = 0;
  comboStreak = 0;
  currentLetter = "b";
  startRound({ paused: true });
}

function pauseGame() {
  if (isPaused) return;

  isPaused = true;

  if (acceptingAnswer) {
    pausedMode = "question";
    freezeTimer();
    feedbackEl.textContent = "暂停中，点继续开始";
  } else {
    pausedMode = "between";
    window.clearTimeout(timerId);
    feedbackEl.textContent = "暂停中，下一题等一等";
  }

  setButtonsDisabled(true);
  feedbackEl.className = "feedback";
  updatePauseButton();
}

function resumeGame() {
  if (!isPaused) return;

  const mode = pausedMode;
  isPaused = false;
  pausedMode = "";
  updatePauseButton();

  if (mode === "question") {
    acceptingAnswer = true;
    setButtonsDisabled(false);
    feedbackEl.textContent = "看清方向，再点按钮";
    feedbackEl.className = "feedback";
    startTimer(roundRemainingMs);
  } else {
    startRound();
  }
}

function togglePause() {
  if (isPaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

choiceButtons.forEach((button) => {
  button.addEventListener("click", () => finishRound(button.dataset.choice));
});

resetButton.addEventListener("click", resetGame);
pauseButton.addEventListener("click", togglePause);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (letters.includes(key)) {
    finishRound(key);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

startRound({ paused: true });
