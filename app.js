const initials = ["b", "d", "p", "q"];
const INITIAL_TIME_LIMIT = 10;
const MIN_TIME_LIMIT = 1;
const SCORE_PER_LEVEL = 20;
const LEVEL_TIME_FACTOR = 0.9;
const STATS_STORAGE_KEY = "bdpq-accuracy-stats-v1";

const modes = {
  english: {
    label: "英语",
    eyebrow: "英语字母辨认",
    prompt: "点击对应的大写字母",
    choices: ["B", "D", "P", "Q"],
  },
  pinyin: {
    label: "拼音",
    eyebrow: "拼音声母辨认",
    prompt: "这个字的声母是？",
    choices: ["b", "d", "p", "q"],
  },
};

const pinyinQuestions = [
  { display: "八", answer: "b", pinyin: "ba" },
  { display: "爸", answer: "b", pinyin: "ba" },
  { display: "不", answer: "b", pinyin: "bu" },
  { display: "白", answer: "b", pinyin: "bai" },
  { display: "北", answer: "b", pinyin: "bei" },
  { display: "半", answer: "b", pinyin: "ban" },
  { display: "大", answer: "d", pinyin: "da" },
  { display: "的", answer: "d", pinyin: "de" },
  { display: "地", answer: "d", pinyin: "di" },
  { display: "东", answer: "d", pinyin: "dong" },
  { display: "冬", answer: "d", pinyin: "dong" },
  { display: "对", answer: "d", pinyin: "dui" },
  { display: "皮", answer: "p", pinyin: "pi" },
  { display: "朋", answer: "p", pinyin: "peng" },
  { display: "平", answer: "p", pinyin: "ping" },
  { display: "跑", answer: "p", pinyin: "pao" },
  { display: "拍", answer: "p", pinyin: "pai" },
  { display: "片", answer: "p", pinyin: "pian" },
  { display: "七", answer: "q", pinyin: "qi" },
  { display: "去", answer: "q", pinyin: "qu" },
  { display: "青", answer: "q", pinyin: "qing" },
  { display: "清", answer: "q", pinyin: "qing" },
  { display: "气", answer: "q", pinyin: "qi" },
  { display: "请", answer: "q", pinyin: "qing" },
];

const englishQuestions = initials.map((letter) => ({
  display: letter,
  answer: letter,
  pinyin: letter,
}));

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

const modeEyebrowEl = document.querySelector("#modeEyebrow");
const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const roundEl = document.querySelector("#round");
const limitEl = document.querySelector("#limit");
const modeLabelEl = document.querySelector("#modeLabel");
const nextLevelHintEl = document.querySelector("#nextLevelHint");
const promptTextEl = document.querySelector("#promptText");
const gameShell = document.querySelector(".game-shell");
const letterCard = document.querySelector(".letter-card");
const letterDisplay = document.querySelector("#letterDisplay");
const feedbackEl = document.querySelector("#feedback");
const timerTrack = document.querySelector("#timerTrack");
const timerFill = document.querySelector("#timerFill");
const comboBadge = document.querySelector("#comboBadge");
const comboCountEl = document.querySelector("#comboCount");
const bestScoreEl = document.querySelector("#bestScore");
const statsFloat = document.querySelector("#statsFloat");
const statsGrid = document.querySelector("#statsGrid");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const choiceButtons = [...document.querySelectorAll(".choice")];

let currentQuestion = { display: "", answer: "b", pinyin: "b" };
let currentMode = "english";
let score = 0;
let level = 1;
let completed = 0;
let timeLimit = INITIAL_TIME_LIMIT;
let comboStreak = 0;
let timerId = null;
let nextRoundId = null;
let roundDeadlineAt = 0;
let roundDurationMs = INITIAL_TIME_LIMIT * 1000;
let roundRemainingMs = roundDurationMs;
let acceptingAnswer = false;
let isPaused = true;
let pausedMode = "question";
let currentThemeIndex = -1;
let bestScore = Number(localStorage.getItem("bdpq-best-score") || 0);
let accuracyStats = loadAccuracyStats();
let audioContext = null;

function formatTime(seconds) {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

function createEmptyAccuracyStats() {
  return Object.fromEntries(
    Object.keys(modes).map((mode) => [
      mode,
      Object.fromEntries(initials.map((initial) => [initial, { correct: 0, total: 0 }])),
    ]),
  );
}

function loadAccuracyStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY));
    const stats = createEmptyAccuracyStats();

    Object.keys(stats).forEach((mode) => {
      initials.forEach((initial) => {
        const savedCell = saved?.[mode]?.[initial];
        if (savedCell) {
          stats[mode][initial].correct = Number(savedCell.correct) || 0;
          stats[mode][initial].total = Number(savedCell.total) || 0;
        }
      });
    });

    return stats;
  } catch {
    return createEmptyAccuracyStats();
  }
}

function saveAccuracyStats() {
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(accuracyStats));
}

function recordAttempt(mode, initial, isCorrect) {
  const cell = accuracyStats[mode][initial];
  cell.total += 1;
  cell.correct += isCorrect ? 1 : 0;
  saveAccuracyStats();
}

function formatAccuracy(cell) {
  if (!cell.total) return "0%";
  return `${Math.round((cell.correct / cell.total) * 100)}%`;
}

function renderAccuracyStats() {
  const modeOrder = ["english", "pinyin"];
  statsGrid.innerHTML = modeOrder
    .map((mode) => {
      const rows = initials
        .map((initial) => {
          const cell = accuracyStats[mode][initial];
          const label = mode === "english" ? initial.toUpperCase() : initial;
          return `
            <div class="stats-row">
              <span>${label}</span>
              <strong>${formatAccuracy(cell)}</strong>
              <small>${cell.correct}/${cell.total}</small>
            </div>
          `;
        })
        .join("");

      return `
        <div class="stats-card">
          <div class="stats-mode">${modes[mode].label}</div>
          ${rows}
        </div>
      `;
    })
    .join("");
}

function toggleMode() {
  currentMode = currentMode === "english" ? "pinyin" : "english";
}

function getQuestionPool() {
  return currentMode === "english" ? englishQuestions : pinyinQuestions;
}

function pickNextQuestion() {
  const pool = getQuestionPool();
  const candidates = pool.filter((question) => question.display !== currentQuestion.display);
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

function updateChoicesForMode() {
  modes[currentMode].choices.forEach((label, index) => {
    choiceButtons[index].textContent = label;
    choiceButtons[index].setAttribute("aria-label", label);
  });
}

function updateStats() {
  const nextLevelScore = level * SCORE_PER_LEVEL;
  const pointsToNextLevel = Math.max(0, nextLevelScore - score);

  scoreEl.textContent = score;
  levelEl.textContent = level;
  roundEl.textContent = completed + 1;
  limitEl.textContent = formatTime(timeLimit);
  modeLabelEl.textContent = modes[currentMode].label;
  nextLevelHintEl.textContent = `差 ${pointsToNextLevel} 分`;
  modeEyebrowEl.textContent = modes[currentMode].eyebrow;
  promptTextEl.textContent = modes[currentMode].prompt;
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

function clearTimers() {
  window.clearTimeout(timerId);
  window.clearTimeout(nextRoundId);
}

function updatePauseButton() {
  pauseButton.textContent = isPaused ? "▶" : "Ⅱ";
  pauseButton.setAttribute("aria-label", isPaused ? "继续" : "暂停");
  pauseButton.setAttribute("title", isPaused ? "继续" : "暂停");
  pauseButton.setAttribute("aria-pressed", String(isPaused));
  gameShell.classList.toggle("is-paused", isPaused);
  letterCard.classList.toggle("is-paused", isPaused);
  statsFloat.hidden = !isPaused;

  if (isPaused) {
    renderAccuracyStats();
  }
}

function startTimer(remainingMs) {
  window.clearTimeout(timerId);

  roundRemainingMs = Math.max(0, remainingMs);
  roundDeadlineAt = Date.now() + roundRemainingMs;

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
    shard.textContent = currentQuestion.display;
    shard.style.setProperty("--clip", clip);
    shard.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    shard.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    shard.style.setProperty("--r", `${index % 2 === 0 ? 32 + index * 9 : -36 - index * 8}deg`);
    shard.style.setProperty("--delay", `${index * 18}ms`);

    letterDisplay.append(shard);
  });
}

function correctAnswerFeedback() {
  if (currentMode === "pinyin") {
    return `“${currentQuestion.display}”的声母是 ${currentQuestion.answer}`;
  }

  return `这次是 ${currentQuestion.answer.toUpperCase()}`;
}

function applyScore(delta) {
  score += delta;

  if (delta > 0) {
    bestScore = Math.max(bestScore, score);
    localStorage.setItem("bdpq-best-score", String(bestScore));
  }

  let leveledUp = false;

  while (score >= level * SCORE_PER_LEVEL) {
    level += 1;
    timeLimit = Math.max(MIN_TIME_LIMIT, Number((timeLimit * LEVEL_TIME_FACTOR).toFixed(2)));
    toggleMode();
    leveledUp = true;
  }

  return leveledUp;
}

function startRound({ paused = false } = {}) {
  clearTimers();
  clearButtonStates();

  currentQuestion = pickNextQuestion();
  roundDurationMs = getTimeLimitMs();
  roundRemainingMs = roundDurationMs;
  acceptingAnswer = true;
  isPaused = paused;
  pausedMode = paused ? "question" : "";

  letterCard.dataset.mode = currentMode;
  letterDisplay.textContent = currentQuestion.display;
  letterDisplay.classList.remove("shattering");
  letterDisplay.style.background = pickNextTheme();
  letterDisplay.classList.remove("pop");
  window.requestAnimationFrame(() => letterDisplay.classList.add("pop"));
  feedbackEl.textContent = paused ? "点继续开始" : "看清题目，再点按钮";
  feedbackEl.className = "feedback";
  updateChoicesForMode();
  setButtonsDisabled(paused);
  updatePauseButton();
  updateStats();

  timerFill.style.transition = "none";
  timerFill.style.transform = "scaleX(1)";

  if (!paused) {
    startTimer(roundDurationMs);
  }
}

function getTimeLimitMs() {
  return timeLimit * 1000;
}

function finishRound(answer) {
  if (!acceptingAnswer || isPaused) return;

  acceptingAnswer = false;
  window.clearTimeout(timerId);
  setButtonsDisabled(true);

  const isCorrect = answer === currentQuestion.answer;
  recordAttempt(currentMode, currentQuestion.answer, isCorrect);
  const correctButton = document.querySelector(`[data-choice="${currentQuestion.answer}"]`);
  correctButton?.classList.add("is-correct");

  if (answer && !isCorrect) {
    document.querySelector(`[data-choice="${answer}"]`)?.classList.add("is-wrong");
  }

  const remainingRatio = roundDurationMs > 0 ? Math.max(0, roundDeadlineAt - Date.now()) / roundDurationMs : 0;
  timerFill.style.transition = "none";
  timerFill.style.transform = `scaleX(${remainingRatio})`;

  if (isCorrect) {
    comboStreak += 1;
    shatterLetter();

    if (applyScore(1)) {
      feedbackEl.textContent = `升级到 ${level} 级，切换到${modes[currentMode].label}！`;
      playSound("level");
    } else {
      feedbackEl.textContent = "答对了，真棒！";
      playSound("correct");
    }

    feedbackEl.className = "feedback correct";
  } else {
    comboStreak = 0;
    applyScore(-1);
    flashMistake({ timeout: answer === null });
    feedbackEl.textContent =
      answer === null ? `时间到，${correctAnswerFeedback()}` : `${correctAnswerFeedback()}，下一题继续`;
    feedbackEl.className = "feedback wrong";
    playSound("wrong");
  }

  completed += 1;
  updateStats();
  nextRoundId = window.setTimeout(() => startRound(), isCorrect ? 850 : 950);
}

function resetGame() {
  clearTimers();
  score = 0;
  level = 1;
  completed = 0;
  timeLimit = INITIAL_TIME_LIMIT;
  comboStreak = 0;
  currentMode = "english";
  currentQuestion = { display: "", answer: "b", pinyin: "b" };
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
    clearTimers();
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
    feedbackEl.textContent = "看清题目，再点按钮";
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

  if (initials.includes(key)) {
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
