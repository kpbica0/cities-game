const SKIP_LETTERS = new Set(["ь", "ъ", "ы", "й"]);

const cityIndex = new Map();
const citiesByFirst = new Map();

function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function canonicalKey(name) {
  return normalizeName(name).toLowerCase();
}

function getLastLetter(name) {
  const letters = normalizeName(name).replace(/[^а-яё]/gi, "").split("");
  let i = letters.length - 1;
  while (i >= 0 && SKIP_LETTERS.has(letters[i])) {
    i -= 1;
  }
  return i >= 0 ? letters[i] : "";
}

function getFirstLetter(name) {
  const match = normalizeName(name).match(/[а-яё]/i);
  return match ? match[0].toLowerCase() : "";
}

function buildIndex() {
  for (const city of CITIES) {
    const key = canonicalKey(city);
    if (cityIndex.has(key)) continue;
    cityIndex.set(key, city);
    const first = getFirstLetter(city);
    if (!first) continue;
    if (!citiesByFirst.has(first)) citiesByFirst.set(first, []);
    citiesByFirst.get(first).push(city);
  }
}

buildIndex();

const state = {
  active: false,
  used: new Set(),
  requiredLetter: "",
  waitingBot: false,
};

const statusEl = document.getElementById("status");
const letterBoxEl = document.getElementById("letterBox");
const requiredLetterEl = document.getElementById("requiredLetter");
const formEl = document.getElementById("form");
const inputEl = document.getElementById("cityInput");
const submitBtnEl = document.getElementById("submitBtn");
const historyListEl = document.getElementById("historyList");
const newGameBtn = document.getElementById("newGameBtn");
const giveUpBtn = document.getElementById("giveUpBtn");

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.classList.remove("win", "lose");
  if (type) statusEl.classList.add(type);
}

function showPlayingUI(show) {
  letterBoxEl.classList.toggle("hidden", !show);
  formEl.classList.toggle("hidden", !show);
  giveUpBtn.classList.toggle("hidden", !show);
  inputEl.disabled = !show || state.waitingBot;
  submitBtnEl.disabled = !show || state.waitingBot;
}

function addHistory(who, city, note = "") {
  if (historyListEl.querySelector(".empty")) {
    historyListEl.innerHTML = "";
  }
  const li = document.createElement("li");
  li.className = who;
  li.textContent = `${who === "player" ? "Ты" : "Бот"}: ${city}${note ? ` — ${note}` : ""}`;
  historyListEl.prepend(li);
}

function availableCities(letter, used) {
  const pool = citiesByFirst.get(letter) || [];
  return pool.filter((city) => !used.has(canonicalKey(city)));
}

function pickBotCity(letter) {
  const options = availableCities(letter, state.used);
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function finishGame(message, type) {
  state.active = false;
  state.waitingBot = false;
  setStatus(message, type);
  showPlayingUI(false);
}

function afterPlayerMove(city) {
  const key = canonicalKey(city);
  state.used.add(key);
  addHistory("player", city);
  state.requiredLetter = getLastLetter(city);
  requiredLetterEl.textContent = state.requiredLetter.toUpperCase();

  const botCity = pickBotCity(state.requiredLetter);
  if (!botCity) {
    finishGame(`Победа! Бот не знает город на «${state.requiredLetter.toUpperCase()}».`, "win");
    return;
  }

  state.waitingBot = true;
  inputEl.disabled = true;
  submitBtnEl.disabled = true;
  setStatus(`Бот думает… следующий город на «${state.requiredLetter.toUpperCase()}».`);

  setTimeout(() => {
    if (!state.active) return;
    state.used.add(canonicalKey(botCity));
    addHistory("bot", botCity);
    state.requiredLetter = getLastLetter(botCity);
    requiredLetterEl.textContent = state.requiredLetter.toUpperCase();

    const playerCanMove = availableCities(state.requiredLetter, state.used).length > 0;
    state.waitingBot = false;
    inputEl.disabled = false;
    submitBtnEl.disabled = false;
    inputEl.focus();

    if (!playerCanMove) {
      finishGame(
        `Проигрыш. На «${state.requiredLetter.toUpperCase()}» (${botCity}) у тебя нет подходящего города.`,
        "lose"
      );
      return;
    }

    setStatus(`Твой ход. Назови город на «${state.requiredLetter.toUpperCase()}».`);
  }, 700);
}

function validatePlayerCity(raw) {
  const name = normalizeName(raw);
  if (!name) return { error: "Введи название города." };

  const key = canonicalKey(name);
  const known = cityIndex.get(key);
  if (!known) {
    return { error: "Такого города нет в списке РФ. Проверь написание." };
  }
  if (state.used.has(key)) {
    return { error: `«${known}» уже был в игре.` };
  }

  if (!state.requiredLetter) {
    return { city: known };
  }

  const first = getFirstLetter(known);
  if (first !== state.requiredLetter) {
    return {
      error: `Нужен город на «${state.requiredLetter.toUpperCase()}», а у «${known}» — «${first.toUpperCase()}».`,
    };
  }

  return { city: known };
}

function startGame() {
  state.active = true;
  state.used = new Set();
  state.requiredLetter = "";
  state.waitingBot = false;
  historyListEl.innerHTML = '<li class="empty">Пока пусто</li>';
  requiredLetterEl.textContent = "—";
  inputEl.value = "";
  setStatus("Твой первый ход. Назови любой город России.");
  showPlayingUI(true);
  inputEl.focus();
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.active || state.waitingBot) return;

  const result = validatePlayerCity(inputEl.value);
  if (result.error) {
    setStatus(result.error);
    return;
  }

  inputEl.value = "";
  afterPlayerMove(result.city);
});

newGameBtn.addEventListener("click", startGame);

giveUpBtn.addEventListener("click", () => {
  if (!state.active) return;
  finishGame("Ты сдался. Нажми «Новая игра», чтобы сыграть ещё.", "lose");
});

inputEl.addEventListener("input", () => {
  inputEl.value = inputEl.value.replace(/[^а-яёА-ЯЁ\s-]/g, "");
});

showPlayingUI(false);
setStatus("Нажми «Новая игра», чтобы начать. Первым ходишь ты.");
