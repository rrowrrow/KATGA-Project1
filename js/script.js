/* KATGA K3 - Wordle-like (5 huruf) khusus istilah K3 */

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
const categoryEl = document.getElementById("category");

/* Data */
let wordsReady = false;
let ANSWERS = [];         // {word, category}
let VALID_SET = new Set();
let answer = null;        // {word, category}

/* State */
let cells = [];
let keyButtons = new Map();
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let guesses = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
let colorHistory = [];

/* Keyboard layout */
const KEY_LAYOUT = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"]
];

const RANK = { b: 1, y: 2, g: 3 };

function setMessage(t){ messageEl.textContent = t || ""; }
function idx(r,c){ return r * COLS + c; }
function getRowWord(r){ return guesses[r].join(""); }
function isRowComplete(r){ return guesses[r].every(ch => ch && ch.length === 1); }

function clampGuessString(s){
  return (s || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, COLS);
}

/* Load JSON K3 */
async function loadK3Words(){
  setMessage("Memuat kamus K3...");
  // Path absolut agar stabil di Vercel (hindari 404 karena path relatif)
  const res = await fetch("/data/k3-words.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Gagal load /data/k3-words.json: " + res.status);

  const data = await res.json();
  if(!data || !Array.isArray(data.answers) || !Array.isArray(data.validGuesses)){
    throw new Error("Format JSON salah. Harus ada answers[] dan validGuesses[]");
  }

  const norm = (w) => String(w).toUpperCase().replace(/[^A-Z]/g,"");

  ANSWERS = data.answers
    .map(x => ({ word: norm(x.word), category: String(x.category || "-") }))
    .filter(x => x.word.length === 5);

  const valid = data.validGuesses.map(norm).filter(w => w.length === 5);

  // Pastikan semua jawaban juga valid ditebak
  for(const a of ANSWERS) valid.push(a.word);

  VALID_SET = new Set(valid);

  if(ANSWERS.length === 0) throw new Error("Jawaban kosong setelah normalisasi.");

  answer = pickDailyAnswer(ANSWERS); // daily
  categoryEl.textContent = answer.category || "-";

  wordsReady = true;
  setMessage("Kamus siap. Tebak istilah K3!");
}

/* Daily answer: random */
function pickRandomAnswer(pool){
  const i = Math.floor(Math.random() * pool.length);
  return pool[i];
}

/* UI build */
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
  renderRow(currentRow);
  inputEl.value = guesses[currentRow].join("");
}

function removeLetter(){
  if(gameOver || currentRow>=ROWS || currentCol<=0) return;
  currentCol--;
  guesses[currentRow][currentCol] = "";
  renderRow(currentRow);
  inputEl.value = guesses[currentRow].join("");
}

/* Evaluasi Wordle (2-pass) */
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

/* Submit */
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
  renderRow(currentRow);

  if(!isRowComplete(currentRow)){
    setMessage("Ketik 5 huruf dulu sebelum submit.");
    return;
  }

  const word = getRowWord(currentRow);

  // Konsep K3: tebakan wajib istilah K3
  if(!VALID_SET.has(word)){
    setMessage("Tebakan harus istilah K3 (tidak ada di kamus K3).");
    return;
  }

  const colors = evaluateGuess(word, answer.word);
  colorHistory.push(colors);

  // warnai tile
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
    return;
  }

  currentRow++;
  currentCol = 0;
  inputEl.value = "";

  if(currentRow >= ROWS){
    setMessage(`😅 Kesempatan habis. Jawabannya: ${answer.word} (${answer.category})`);
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

/* Share */
function buildShareText(isFinal){
  const mapEmoji = { g:"🟩", y:"🟨", b:"⬜" };
  const tries = colorHistory.length;
  const score = isFinal ? `${tries}/${ROWS}` : `${tries}/${ROWS} (sementara)`;

  let out = `KATGA K3 ${score}\nKategori: ${answer?.category || "-"}\n`;
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
  setMessage(ok ? "✅ Hasil disalin ke clipboard!" : "❌ Gagal copy otomatis. Salin manual.");
}

/* Reset */
function resetGame(){
  if(!wordsReady) return;

  answer = pickRandomAnswer(ANSWERS);
  categoryEl.textContent = answer.category || "-";

  currentRow = 0;
  currentCol = 0;
  gameOver = false;
  guesses = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
  colorHistory = [];

  // reset UI
  submitBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.value = "";
  shareBtn.disabled = true;
  shareTextEl.value = "";

  buildBoard();
  buildKeyboard();
  setMessage("Reset. Tebak lagi!");
}

/* Event */
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
  renderRow(currentRow);
});

submitBtn.addEventListener("click", submitRow);
resetBtn.addEventListener("click", resetGame);
shareBtn.addEventListener("click", handleShare);

/* Init */
(async function init(){
  buildBoard();
  buildKeyboard();
  shareBtn.disabled = true;

  try{
    await loadK3Words();
  }catch(err){
    console.error(err);
    setMessage("❌ Gagal memuat data K3. Pastikan data/k3-words.json ada & path benar.");
  }
})();
