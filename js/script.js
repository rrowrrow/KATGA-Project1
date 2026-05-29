/* =========================
   KATGA K3 - 5 huruf
   - answers: istilah K3 (dengan meaning)
   - validGuesses: kata Indonesia umum (5 huruf)
   - jawaban ganti otomatis (shuffle bag)
   - benar => popup makna kata
   ========================= */

(() => {
  const ROWS = 6;
  const COLS = 5;

  // ===== DOM =====
  const boardEl = document.getElementById("board");
  const keyboardEl = document.getElementById("keyboard");
  const inputEl = document.getElementById("guess");
  const submitBtn = document.getElementById("submit");
  const resetBtn = document.getElementById("reset");
  const shareBtn = document.getElementById("share");
  const messageEl = document.getElementById("message");
  const shareTextEl = document.getElementById("shareText");

  // Modal (muncul saat menang)
  const meaningModal = document.getElementById("meaningModal");
  const modalWordEl = document.getElementById("modalWord");
  const modalMeaningEl = document.getElementById("modalMeaning");
  const closeModalBtn = document.getElementById("closeModal");

  // ===== Guards (biar gampang debug kalau HTML kurang) =====
  const must = (el, id) => {
    if (!el) throw new Error(`Elemen #${id} tidak ditemukan di index.html`);
    return el;
  };
  must(boardEl, "board");
  must(keyboardEl, "keyboard");
  must(inputEl, "guess");
  must(submitBtn, "submit");
  must(resetBtn, "reset");
  must(shareBtn, "share");
  must(messageEl, "message");
  must(shareTextEl, "shareText");
  must(meaningModal, "meaningModal");
  must(modalWordEl, "modalWord");
  must(modalMeaningEl, "modalMeaning");
  must(closeModalBtn, "closeModal");

  // ===== Keyboard layout =====
  const KEY_LAYOUT = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENTER","Z","X","C","V","B","N","M","⌫"]
  ];

  // ranking warna keyboard: hijau > kuning > abu
  const RANK = { b: 1, y: 2, g: 3 };

  // ===== Data =====
  let wordsReady = false;
  let ANSWERS = [];     // [{word, meaning}]
  let VALID_SET = new Set(); // valid guesses (uppercase)
  let answer = null;    // {word, meaning}

  // ===== State =====
  let cells = [];
  let keyButtons = new Map();
  let currentRow = 0;
  let currentCol = 0;
  let gameOver = false;
  let guesses = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
  let colorHistory = []; // array of ["g"|"y"|"b"] per row

  // ===== Utilities =====
  const setMessage = (t) => { messageEl.textContent = t || ""; };

  const normalize = (w) =>
    String(w || "").toUpperCase().replace(/[^A-Z]/g, "");

  const isValid5 = (w) => /^[A-Z]{5}$/.test(w);

  const idx = (r, c) => r * COLS + c;

  const rowWord = (r) => guesses[r].join("");

  const rowComplete = (r) => guesses[r].every(ch => /^[A-Z]$/.test(ch));

  const clampGuess = (s) => normalize(s).slice(0, COLS);

  // ===== Modal controls (vanilla) =====
  function openMeaningModal(word, meaning) {
    modalWordEl.textContent = word;
    modalMeaningEl.textContent = meaning || "Makna belum tersedia.";
    meaningModal.classList.add("show");
    meaningModal.setAttribute("aria-hidden", "false");
  }

  function closeMeaningModal() {
    meaningModal.classList.remove("show");
    meaningModal.setAttribute("aria-hidden", "true");
  }

  closeModalBtn.addEventListener("click", closeMeaningModal);
  meaningModal.addEventListener("click", (e) => {
    if (e.target === meaningModal) closeMeaningModal(); // klik backdrop
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMeaningModal();
  });

  // ===== Evaluate (Wordle 2-pass, handle huruf ganda) =====
  function evaluateGuess(guess, answerWord) {
    const result = Array(COLS).fill("b");
    const ans = answerWord.split("");
    const g = guess.split("");

    // green
    for (let i = 0; i < COLS; i++) {
      if (g[i] === ans[i]) {
        result[i] = "g";
        ans[i] = null;
      }
    }
    // yellow
    for (let i = 0; i < COLS; i++) {
      if (result[i] === "g") continue;
      const j = ans.indexOf(g[i]);
      if (j !== -1) {
        result[i] = "y";
        ans[j] = null;
      }
    }
    return result;
  }

  // ===== Keyboard coloring =====
  function keyColor(btn) {
    if (btn.classList.contains("g")) return "g";
    if (btn.classList.contains("y")) return "y";
    if (btn.classList.contains("b")) return "b";
    return null;
  }

  function updateKeyboard(word, colors) {
    for (let i = 0; i < COLS; i++) {
      const letter = word[i];
      const color = colors[i];
      const btn = keyButtons.get(letter);
      if (!btn) continue;

      const existing = keyColor(btn);
      if (!existing || RANK[color] > RANK[existing]) {
        btn.classList.remove("g","y","b");
        btn.classList.add(color);
      }
    }
  }

  // ===== Build board =====
  function buildBoard() {
    boardEl.innerHTML = "";
    cells = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.textContent = "";
        boardEl.appendChild(cell);
        cells.push(cell);
      }
    }
  }

  function renderRow(r) {
    for (let c = 0; c < COLS; c++) {
      const cell = cells[idx(r, c)];
      cell.textContent = guesses[r][c] || "";
      // warna hanya dipasang saat submit, jadi jangan reset warna row sebelumnya
      if (r === currentRow) cell.classList.remove("g","y","b");
    }
  }

  // ===== Build keyboard =====
  function buildKeyboard() {
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
        if (k === "ENTER" || k === "⌫") btn.classList.add("wide");
        btn.addEventListener("click", () => onVirtualKey(k));
        row.appendChild(btn);

        if (/^[A-Z]$/.test(k)) keyButtons.set(k, btn);
      });

      keyboardEl.appendChild(row);
    });
  }

  // ===== Input handling =====
  function addLetter(ch) {
    if (gameOver) return;
    if (currentRow >= ROWS) return;
    if (currentCol >= COLS) return;

    guesses[currentRow][currentCol] = ch;
    cells[idx(currentRow, currentCol)].textContent = ch;
    currentCol++;
    inputEl.value = guesses[currentRow].join("");
  }

  function removeLetter() {
    if (gameOver) return;
    if (currentRow >= ROWS) return;
    if (currentCol <= 0) return;

    currentCol--;
    guesses[currentRow][currentCol] = "";
    cells[idx(currentRow, currentCol)].textContent = "";
    inputEl.value = guesses[currentRow].join("");
  }

  function onVirtualKey(k) {
    setMessage("");
    if (k === "ENTER") return submitRow();
    if (k === "⌫") return removeLetter();
    addLetter(k);
  }

  // ===== Share =====
  function buildShareText(final) {
    const mapEmoji = { g: "🟩", y: "🟨", b: "⬜" };
    const tries = colorHistory.length;
    const score = final ? `${tries}/${ROWS}` : `${tries}/${ROWS} (sementara)`;

    let out = `KATGA K3 ${score}\n`;
    for (const row of colorHistory) {
      out += row.map(x => mapEmoji[x] || "⬜").join("") + "\n";
    }
    return out.trimEnd();
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // fallback
      try {
        shareTextEl.value = text;
        shareTextEl.focus();
        shareTextEl.select();
        document.execCommand("copy");
        return true;
      } catch (__) {
        return false;
      }
    }
  }

  async function onShare() {
    const text = buildShareText(true);
    shareTextEl.value = text;
    const ok = await copyToClipboard(text);
    setMessage(ok ? "✅ Hasil disalin!" : "❌ Gagal copy otomatis. Salin manual.");
  }

  // ===== Shuffle-bag answers (tidak mengulang sampai habis) =====
  const BAG_KEY = "katga_k3_answer_bag_v2";

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function refillBag() {
    const bag = shuffleArray(ANSWERS.map(a => a.word).slice());
    localStorage.setItem(BAG_KEY, JSON.stringify(bag));
    return bag;
  }

  function pickNextAnswer() {
    let bag;
    try {
      bag = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
    } catch (_) {
      bag = [];
    }

    if (!Array.isArray(bag) || bag.length === 0) {
      bag = refillBag();
    }

    const nextWord = bag.pop();
    localStorage.setItem(BAG_KEY, JSON.stringify(bag));

    const found = ANSWERS.find(a => a.word === nextWord);
    answer = found || { word: nextWord, meaning: "" };
  }

  // ===== Submit row =====
  function submitRow() {
    if (!wordsReady) return setMessage("Kamus belum siap.");
    if (gameOver) return;

    // Sinkron input manual (mobile)
    const clean = clampGuess(inputEl.value);
    guesses[currentRow] = Array(COLS).fill("");
    for (let i = 0; i < clean.length; i++) guesses[currentRow][i] = clean[i];
    currentCol = clean.length;
    renderRow(currentRow);

    if (!rowComplete(currentRow)) {
      return setMessage("Ketik 5 huruf dulu.");
    }

    const word = rowWord(currentRow);

    // Validasi: harus ada di kamus validGuesses
    if (!VALID_SET.has(word)) {
      return setMessage("Kata tidak ada di kamus.");
    }

    const colors = evaluateGuess(word, answer.word);
    colorHistory.push(colors);

    // warnai tile row ini
    for (let c = 0; c < COLS; c++) {
      const cell = cells[idx(currentRow, c)];
      cell.classList.remove("g","y","b");
      cell.classList.add(colors[c]);
    }

    updateKeyboard(word, colors);

    // share
    shareBtn.disabled = colorHistory.length === 0;
    shareTextEl.value = buildShareText(false);

    // menang
    if (word === answer.word) {
      setMessage("🎉 Benar! Kamu menang!");
      endGame(true);
      // popup makna
      openMeaningModal(answer.word, answer.meaning);
      return;
    }

    // lanjut
    currentRow++;
    currentCol = 0;
    inputEl.value = "";

    if (currentRow >= ROWS) {
      setMessage(`😅 Kesempatan habis. Jawabannya: ${answer.word}`);
      endGame(false);
      return;
    }

    setMessage(`Sisa percobaan: ${ROWS - currentRow}`);
  }

  function endGame(won) {
    gameOver = true;
    submitBtn.disabled = true;
    inputEl.disabled = true;
    shareTextEl.value = buildShareText(true);
  }

  // ===== Reset game =====
  function resetGame() {
    if (!wordsReady) return;

    // jawaban baru otomatis
    pickNextAnswer();

    // reset state
    currentRow = 0;
    currentCol = 0;
    gameOver = false;
    guesses = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    colorHistory = [];

    // reset ui
    buildBoard();
    buildKeyboard();
    inputEl.disabled = false;
    submitBtn.disabled = false;
    inputEl.value = "";
    shareBtn.disabled = true;
    shareTextEl.value = "";
    setMessage("Game baru. Tebak lagi!");
    closeMeaningModal();
  }

  // ===== Load data =====
  async function loadData() {
    setMessage("Memuat kamus...");
    const res = await fetch("/data/k3-words.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Gagal load /data/k3-words.json (${res.status})`);
    const data = await res.json();

    // answers: [{word, meaning}]
    const rawAnswers = Array.isArray(data.answers) ? data.answers : [];
    ANSWERS = rawAnswers
      .map(a => ({
        word: normalize(a.word),
        meaning: String(a.meaning || "")
      }))
      .filter(a => isValid5(a.word));

    if (ANSWERS.length === 0) {
      throw new Error("answers kosong / tidak ada yang valid 5 huruf.");
    }

    // validGuesses: [string]
    const rawValid = Array.isArray(data.validGuesses) ? data.validGuesses : [];
    const cleaned = rawValid.map(normalize).filter(isValid5);
    // pastikan semua answers termasuk valid
    for (const a of ANSWERS) cleaned.push(a.word);

    VALID_SET = new Set(cleaned);

    wordsReady = true;
    pickNextAnswer();
    setMessage("Siap! Mulai tebak.");
  }

  // ===== Events =====
  submitBtn.addEventListener("click", submitRow);
  resetBtn.addEventListener("click", resetGame);
  shareBtn.addEventListener("click", onShare);

  document.addEventListener("keydown", (e) => {
    if (gameOver) return;
    if (e.key === "Enter") { e.preventDefault(); return submitRow(); }
    if (e.key === "Backspace") { e.preventDefault(); return removeLetter(); }
    if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); return addLetter(e.key.toUpperCase()); }
  });

  inputEl.addEventListener("input", () => {
    if (gameOver) return;
    const clean = clampGuess(inputEl.value);
    guesses[currentRow] = Array(COLS).fill("");
    for (let i = 0; i < clean.length; i++) guesses[currentRow][i] = clean[i];
    currentCol = clean.length;

    // render row aktif
    for (let c = 0; c < COLS; c++) {
      cells[idx(currentRow, c)].textContent = guesses[currentRow][c] || "";
    }
  });

  // ===== Init =====
  (async function init() {
    buildBoard();
    buildKeyboard();
    shareBtn.disabled = true;

    try {
      await loadData();
    } catch (err) {
      console.error(err);
      setMessage("❌ Gagal memuat data. Pastikan /data/k3-words.json ada dan formatnya benar.");
    }
  })();

})();
