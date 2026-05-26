/* KATGA K3 (5 huruf) + popup makna kata saat menang */

const ROWS = 6;
const COLS = 5;

/* DOM */
const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const inputEl = document.getElementById("guess");
const submitBtn = document.getElementById("submit");
const resetBtn = document.getElementById("reset");
const shareBtn = document.getElementById("share");
const messageEl = document.getElementById("message");
const shareTextEl = document.getElementById("shareText");

/* Modal DOM */
const meaningModal = document.getElementById("meaningModal");
const modalWordEl = document.getElementById("modalWord");
const modalMeaningEl = document.getElementById("modalMeaning");
const closeModalBtn = document.getElementById("closeModal");

/* Keyboard layout */
const KEY_LAYOUT = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"]
];

const RANK = { b: 1, y: 2, g: 3 };

/* Game data */
let wordsReady = false;
let ANSWERS = [];         // [{word, meaning}]
let VALID_SET = new Set();
let answer = null;        // {word, meaning}

/* State */
let cells = [];
let keyButtons = new Map();
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let guesses = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
let colorHistory = [];

/* Helpers */
function setMessage(t){ messageEl.textContent = t || ""; }
function idx(r,c){ return r * COLS + c; }
function getRowWord(r){ return guesses[r].join(""); }
function isRowComplete(r){ return guesses[r].every(ch => ch && ch.length === 1); }

function clampGuessString(s){
  return (s || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, COLS);
}

/* ===== Modal functions ===== */
function openMeaningModal(word, meaning){
  modalWordEl.textContent = word;
  modalMeaningEl.textContent = meaning || "Belum ada definisi untuk kata ini.";
  meaningModal.classList.add("show");
  meaningModal.setAttribute("aria-hidden", "false");
}
function closeMeaningModal(){
  meaningModal.classList.remove("show");
  meaningModal.setAttribute("aria-hidden", "true");
}
closeModalBtn.addEventListener("click", closeMeaningModal);
meaningModal.addEventListener("click", (e) => {
  if(e.target === meaningModal) closeMeaningModal();
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") closeMeaningModal();
});

/* ===== Load JSON ===== */
async function loadK3Words(){
  setMessage("Memuat kamus K3...");
  const res = await fetch("/k3-words.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Gagal load /data/k3-words.json: " + res.status);

  const data = await res.json();
  if(!data || !Array.isArray(data.answers) || !Array.isArray(data.validGuesses)){
    throw new Error("Format JSON salah. Harus ada answers[] dan validGuesses[]");
  }

  const norm = (w) => String(w).toUpperCase().replace(/[^A-Z]/g,"");

  ANSWERS = data.answers
    .map(x => ({
      word: norm(x.word),
      meaning: String(x.meaning || "")
    }))
    .filter(x => x.word.length === 5);

  const valid = data.validGuesses.map(norm).filter(w => w.length === 5);
  // pastikan semua jawaban juga valid
  for(const a of ANSWERS) valid.push(a.word);
  VALID_SET = new Set(valid);

  if(ANSWERS.length === 0) throw new Error("Jawaban kosong setelah normalisasi.");

  wordsReady = true;
  setMessage("Kamus siap. Mulai tebak!");
  pickNextAnswer(); // set answer pertama
}

/* ===== Shuffle Bag (jawaban tidak berulang sampai habis) ===== */
const BAG_KEY = "katga_k3_answer_bag_v1";

function newShuffledBag(){
  const arr = ANSWERS.map(x => x.word);
  // Fisher-Yates shuffle
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickNextAnswer(){
  let bag = [];
  try { bag = JSON.parse(localStorage.getItem(BAG_KEY) || "[]"); } catch(_) { bag = []; }

  if(!Array.isArray(bag) || bag.length === 0){
    bag = newShuffledBag();
  }

  const nextWord = bag.pop();
  localStorage.setItem(BAG_KEY, JSON.stringify(bag));

  // ambil meaning dari ANSWERS
  const found = ANSWERS.find(x => x.word === nextWord);
  answer = found || { word: nextWord, meaning: "" };
}

/* ===== UI build ===== */
function buildBoard(){
  boardEl.innerHTML = "";
  cells = [];
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const cell = document.createElement("div");
      cell.className = "cell";
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }
  renderAll();
}

function renderAll(){
  for(let r=0;r<ROWS;r++) renderRow(r);
}

function renderRow(r){
  for(let c=0;c<COLS;c++){
    cells[idx(r,c)].textContent = guesses[r][c] || "";
    // jangan reset warna row lama di sini
    if(r >= currentRow){
      // row aktif dan setelahnya bersih warnanya
      cells[idx(r,c)].classList.remove("g","y","b");
    }
  }
}

function buildKeyboard(){
  keyboardEl.innerHTML = "";
  keyButtons.clear();

  KEY_LAYOUT.forEach(rowKeys => {
    const row = document.createElement("div");
    row.className = "krow";

    rowKeys.forEach(k => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.textContent = k;
      if(k === "ENTER" || k === "⌫") btn.classList.add("wide");

      btn.addEventListener("click", () => handleVirtualKey(k));
      row.appendChild(btn);

      if(/^[A-Z]$/.test(k)) keyButtons.set(k, btn);
    });

    keyboardEl.appendChild(row);
  });
}

function handleVirtualKey(k){
  if(gameOver) return;
  setMessage("");

  if(k === "ENTER") return submitRow();
  if(k === "⌫") return removeLetter();
  addLetter(k);
}

function addLetter(ch){
  if(gameOver || currentRow>=ROWS || currentCol>=COLS) return;
  guesses[currentRow][currentCol] = ch;
  currentCol++;
  cells[idx(currentRow, currentCol-1)].textContent = ch;
  inputEl.value = guesses[currentRow].join("");
}

function removeLetter(){
  if(gameOver || currentRow>=ROWS || currentCol<=0) return;
  currentCol--;
  guesses[currentRow][currentCol] = "";
  cells[idx(currentRow, currentCol)].textContent = "";
  inputEl.value = guesses[currentRow].join("");
}

/* ===== Evaluate Wordle (2-pass) ===== */
function evaluateGuess(guess, answerWord){
  const result = Array(COLS).fill("b");
  const ans = answerWord.split("");
  const g = guess.split("");

  // green
  for(let i=0;i<COLS;i++){
    if(g[i] === ans[i]){
      result[i] = "g";
      ans[i] = null;
    }
  }
  // yellow
  for(let i=0;i<COLS;i++){
    if(result[i] === "g") continue;
    const j = ans.indexOf(g[i]);
    if(j !== -1){
      result[i] = "y";
      ans[j] = null;
    }
  }
  return result;
}

function currentKeyColor(btn){
  if(btn.classList.contains("g")) return "g";
  if(btn.classList.contains("y")) return "y";
  if(btn.classList.contains("b")) return "b";
  return null;
}

function updateKeyboardColors(word, colors){
  for(let i=0;i<COLS;i++){
    const letter = word[i];
    const color = colors[i];
    const btn = keyButtons.get(letter);
    if(!btn) continue;

    const existing = currentKeyColor(btn);
    if(!existing || RANK[color] > RANK[existing]){
      btn.classList.remove("g","y","b");
      btn.classList.add(color);
    }
  }
}

/* ===== Share ===== */
function buildShareText(isFinal){
  const mapEmoji = { g:"🟩", y:"🟨", b:"⬜" };
  const tries = colorHistory.length;
  const score = isFinal ? `${tries}/${ROWS}` : `${tries}/${ROWS} (sementara)`;

  let out = `KATGA K3 ${score}\n`;
  for(const row of colorHistory){
    out += row.map(x => mapEmoji[x] || "⬜").join("") + "\n";
  }
  return out.trimEnd();
}

async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch(_){
    try{
      shareTextEl.focus();
      shareTextEl.select();
      document.execCommand("copy");
      return true;
    }catch(__){
      return false;
    }
  }
}

async function handleShare(){
  const text = buildShareText(true);
  shareTextEl.value = text;
  const ok = await copyToClipboard(text);
  setMessage(ok ? "✅ Hasil disalin!" : "❌ Gagal copy otomatis. Salin manual.");
}

/* ===== Submit ===== */
function submitRow(){
  if(!wordsReady){
    setMessage("Kamus belum siap / file data belum terbaca.");
    return;
  }
  if(gameOver || currentRow>=ROWS) return;

  // sinkron input (mobile)
  const clean = clampGuessString(inputEl.value);
  guesses[currentRow] = Array(COLS).fill("");
  for(let i=0;i<clean.length;i++) guesses[currentRow][i] = clean[i];
  currentCol = clean.length;

  // render row aktif
  for(let c=0;c<COLS;c++){
    cells[idx(currentRow,c)].textContent = guesses[currentRow][c] || "";
  }

  if(!isRowComplete(currentRow)){
    setMessage("Ketik 5 huruf dulu sebelum submit.");
    return;
  }

  const word = getRowWord(currentRow);

  // Mode kamus: harus ada di valid list
  if(!VALID_SET.has(word)){
    setMessage("Kata tidak ada di kamus K3.");
    return;
  }

  const colors = evaluateGuess(word, answer.word);
  colorHistory.push(colors);

  // warnai tile row ini
  for(let c=0;c<COLS;c++){
    const cell = cells[idx(currentRow,c)];
    cell.classList.remove("g","y","b");
    cell.classList.add(colors[c]);
  }

  updateKeyboardColors(word, colors);

  shareBtn.disabled = colorHistory.length === 0;
  shareTextEl.value = buildShareText(false);

  if(word === answer.word){
    setMessage("🎉 Benar! Kamu menang!");
    endGame();
    shareTextEl.value = buildShareText(true);
    openMeaningModal(answer.word, answer.meaning);
    return;
  }

  currentRow++;
  currentCol = 0;
  inputEl.value = "";

  if(currentRow >= ROWS){
    setMessage(`😅 Kesempatan habis. Jawabannya: ${answer.word}`);
    endGame();
    shareTextEl.value = buildShareText(true);
    return;
  }

  setMessage(`Sisa percobaan: ${ROWS - currentRow}`);
}

function endGame(){
  gameOver = true;
  submitBtn.disabled = true;
  inputEl.disabled = true;
}

/* ===== Reset ===== */
function resetGame(){
  if(!wordsReady) return;

  // ganti jawaban (random non-repeat via bag)
  pickNextAnswer();

  currentRow = 0;
  currentCol = 0;
  gameOver = false;
  guesses = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
  colorHistory = [];

  submitBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.value = "";
  shareBtn.disabled = true;
  shareTextEl.value = "";

  // reset keyboard colors
  buildBoard();
  buildKeyboard();
  setMessage("Game baru. Tebak lagi!");
}

/* ===== Events ===== */
document.addEventListener("keydown", (e) => {
  if(gameOver) return;

  if(e.key === "Enter") { e.preventDefault(); return submitRow(); }
  if(e.key === "Backspace") { e.preventDefault(); return removeLetter(); }
  if(/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); return addLetter(e.key.toUpperCase()); }
});

inputEl.addEventListener("input", () => {
  if(gameOver) return;
  const clean = clampGuessString(inputEl.value);
  guesses[currentRow] = Array(COLS).fill("");
  for(let i=0;i<clean.length;i++) guesses[currentRow][i] = clean[i];
  currentCol = clean.length;

  for(let c=0;c<COLS;c++){
    cells[idx(currentRow,c)].textContent = guesses[currentRow][c] || "";
  }
});

submitBtn.addEventListener("click", submitRow);
resetBtn.addEventListener("click", resetGame);
shareBtn.addEventListener("click", handleShare);

/* ===== Init ===== */
(async function init(){
  buildBoard();
  buildKeyboard();
  shareBtn.disabled = true;

  try{
    await loadK3Words();
  }catch(err){
    console.error(err);
    setMessage("❌ Gagal memuat data. Pastikan file ada di /data/k3-words.json");
  }
})();
