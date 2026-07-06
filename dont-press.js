// 押したら負け:本物のボタンを押した瞬間ゲームオーバー。
// 時間経過でトリック(誘惑)がエスカレートするサバイバル型。

const realButton = document.getElementById("realButton");
const timerEl = document.getElementById("timer");
const highscoreEl = document.getElementById("highscore");
const messageEl = document.getElementById("message");
const blackoutEl = document.getElementById("blackout");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");
const resultEl = document.getElementById("result");

let running = false;
let startTime = 0;
let mouseX = innerWidth / 2;
let mouseY = innerHeight / 2;
let chasing = false;        // ③ ボタンがカーソルを追いかけるモード
let trickTimer = null;

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function elapsedSec() {
  return (Date.now() - startTime) / 1000;
}

function loadHighscore() {
  return Number(localStorage.getItem("dontPressHighscore") || 0);
}

function showHighscore() {
  highscoreEl.textContent = `ハイスコア: ${loadHighscore().toFixed(1)}秒`;
}

function setMessage(text, ms = 3500) {
  messageEl.textContent = text;
  if (ms > 0) {
    setTimeout(() => {
      if (messageEl.textContent === text) messageEl.textContent = "";
    }, ms);
  }
}

function centerButton() {
  realButton.style.left = `${innerWidth / 2 - realButton.offsetWidth / 2}px`;
  realButton.style.top = `${innerHeight / 2 - realButton.offsetHeight / 2}px`;
}

function moveButtonTo(x, y) {
  const w = realButton.offsetWidth;
  const h = realButton.offsetHeight;
  realButton.style.left = `${Math.max(0, Math.min(innerWidth - w, x))}px`;
  realButton.style.top = `${Math.max(60, Math.min(innerHeight - h, y))}px`;
}

// ---- トリック(誘惑)たち ----

const taunts = [
  "……ほんとに押さないの?",
  "何も起きなくてつまらなくない?",
  "一回だけなら大丈夫かもよ。",
  "みんな最初の1分で押しちゃうんだよね。",
  "そのボタン、実は良いことが起きるらしいよ。",
];

function trickTaunt() {
  setMessage(taunts[Math.floor(Math.random() * taunts.length)]);
}

// ② 嘘の許可メッセージ+ボタンが安全そうな緑に変わる
function trickFakePermission() {
  realButton.classList.add("tempting");
  realButton.textContent = "押してOK!";
  setMessage("✅ 検証が完了しました。ボタンは安全になりました。");
  setTimeout(() => {
    realButton.classList.remove("tempting");
    realButton.textContent = "押すな";
    setMessage("……なんてね。");
  }, 4000);
}

// ② 偽カウントダウンで焦らせる
function trickFakeCountdown() {
  let n = 3;
  setMessage(`⚠️ ${n}秒以内に押さないと記録が消えます!`, 0);
  const iv = setInterval(() => {
    n--;
    if (!running) { clearInterval(iv); return; }
    if (n > 0) {
      setMessage(`⚠️ ${n}秒以内に押さないと記録が消えます!`, 0);
    } else {
      clearInterval(iv);
      setMessage("（嘘です。よく我慢したね)");
    }
  }, 1000);
}

// ① 偽ダイアログ。OKを押してもセーフだが、本物ボタンがOKの近くに滑り込む
function trickFakeDialog() {
  const dialog = document.createElement("div");
  dialog.className = "fake-dialog";
  dialog.innerHTML =
    "⚠️ エラーが発生しました。<br>続行するには OK を押してください。" +
    '<button class="dialog-ok">OK</button>';
  const x = Math.random() * (innerWidth - 340) + 20;
  const y = Math.random() * (innerHeight - 260) + 80;
  dialog.style.left = `${x}px`;
  dialog.style.top = `${y}px`;
  document.body.appendChild(dialog);

  // OKボタンへ向かう軌道のそばに本物を移動させる罠
  setTimeout(() => {
    if (running) moveButtonTo(x + 90, y + 120);
  }, 600);

  dialog.querySelector(".dialog-ok").addEventListener("click", () => {
    dialog.remove();
    setMessage("そのOKは偽物。でも本物を踏まなくてえらい。");
  });
  setTimeout(() => dialog.remove(), 7000);
}

// ① お得そうな偽ボタンをばらまく
function trickFakeButtons() {
  const count = 3;
  for (let i = 0; i < count; i++) {
    const b = document.createElement("button");
    b.className = "fake-button";
    b.textContent = ["スコア+10", "無敵になる", "× 閉じる"][i % 3];
    b.style.left = `${Math.random() * (innerWidth - 140) + 10}px`;
    b.style.top = `${Math.random() * (innerHeight - 160) + 70}px`;
    document.body.appendChild(b);
    b.addEventListener("click", () => {
      b.remove();
      setMessage("それは偽ボタン。何も起きません。");
    });
    setTimeout(() => b.remove(), 6000);
  }
  // 偽ボタン回遊の動線ど真ん中(画面中央)に本物を移動
  setTimeout(() => {
    if (running) moveButtonTo(innerWidth / 2 - 60, innerHeight / 2 - 40);
  }, 800);
}

// ③ ボタンがカーソルを5秒間追いかけてくる
function trickChase() {
  setMessage("!! ボタンがこっちに来る!逃げろ!");
  chasing = true;
  setTimeout(() => { chasing = false; }, 5000);
}

// ③ 暗転して、復帰した瞬間ボタンがカーソルのすぐそばにいる
function trickBlackout() {
  blackoutEl.style.opacity = "1";
  setTimeout(() => {
    if (running) moveButtonTo(mouseX - 40, mouseY - 20);
    blackoutEl.style.opacity = "0";
    setMessage("停電から復帰しました。手元に注意。");
  }, 900);
}

// ---- トリックのスケジューリング(時間経過でエスカレート) ----

function pickTrick() {
  const t = elapsedSec();
  let pool;
  if (t < 15) {
    pool = [trickTaunt];
  } else if (t < 30) {
    pool = [trickTaunt, trickFakeCountdown, trickFakePermission];
  } else if (t < 60) {
    pool = [trickTaunt, trickFakeCountdown, trickFakePermission, trickFakeDialog, trickFakeButtons];
  } else {
    pool = [trickFakePermission, trickFakeDialog, trickFakeButtons, trickChase, trickBlackout];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function scheduleNextTrick() {
  if (!running) return;
  // 序盤は間隔長め、終盤は畳みかける
  const t = elapsedSec();
  const delay = t < 15 ? 6000 : t < 60 ? 4500 : 2800;
  trickTimer = setTimeout(() => {
    if (!running) return;
    pickTrick()();
    scheduleNextTrick();
  }, delay);
}

// ---- メインループ(タイマー表示と追跡モード) ----

function frame() {
  if (!running) return;
  timerEl.textContent = `${elapsedSec().toFixed(1)}秒`;

  if (chasing) {
    const bx = realButton.offsetLeft + realButton.offsetWidth / 2;
    const by = realButton.offsetTop + realButton.offsetHeight / 2;
    const dx = mouseX - bx;
    const dy = mouseY - by;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 3.5;
    moveButtonTo(
      realButton.offsetLeft + (dx / dist) * speed,
      realButton.offsetTop + (dy / dist) * speed
    );
  }
  requestAnimationFrame(frame);
}

// ---- ゲーム開始と終了 ----

function startGame() {
  document.querySelectorAll(".fake-button, .fake-dialog").forEach((el) => el.remove());
  overlay.classList.add("hidden");
  realButton.classList.remove("tempting");
  realButton.textContent = "押すな";
  messageEl.textContent = "";
  centerButton();
  running = true;
  startTime = Date.now();
  showHighscore();
  scheduleNextTrick();
  requestAnimationFrame(frame);
}

function gameOver() {
  if (!running) return;
  running = false;
  chasing = false;
  clearTimeout(trickTimer);
  const score = elapsedSec();
  const best = loadHighscore();
  let recordText = "";
  if (score > best) {
    localStorage.setItem("dontPressHighscore", score.toFixed(1));
    recordText = "🎉 ハイスコア更新!";
  }
  resultEl.innerHTML =
    `<p style="font-size:22px">押しちゃったね。<br>生存時間: <strong>${score.toFixed(1)}秒</strong></p>` +
    `<p>${recordText} ハイスコア: ${loadHighscore().toFixed(1)}秒</p>`;
  startButton.textContent = "もう一度";
  overlay.classList.remove("hidden");
}

realButton.addEventListener("click", gameOver);
startButton.addEventListener("click", startGame);
window.addEventListener("resize", () => { if (!running) centerButton(); });

showHighscore();
centerButton();
