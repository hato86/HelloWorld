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
let frozenTimer = false;    // 偽ポーズ中はタイマー表示を止める
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
    gameOver("偽ダイアログのOKを押してしまった…!");
  });
  setTimeout(() => dialog.remove(), 7000);
}

// ① お得そうな偽ボタンをばらまく
function trickFakeButtons() {
  const count = 4;
  for (let i = 0; i < count; i++) {
    const b = document.createElement("button");
    b.className = "fake-button";
    b.textContent = ["スコア+10", "無敵になる", "× 閉じる"][i % 3];
    b.style.left = `${Math.random() * (innerWidth - 140) + 10}px`;
    b.style.top = `${Math.random() * (innerHeight - 160) + 70}px`;
    document.body.appendChild(b);
    b.addEventListener("click", () => {
      gameOver(`「${b.textContent}」は罠でした…!`);
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

// ① 本物そっくりの「押すな」ボタンが増殖する(全部罠)
function trickCloneButtons() {
  setMessage("増えた!? どれも押すな!");
  for (let i = 0; i < 3; i++) {
    const c = document.createElement("button");
    c.className = "clone-button";
    c.textContent = "押すな";
    c.style.left = `${Math.random() * (innerWidth - 200) + 10}px`;
    c.style.top = `${Math.random() * (innerHeight - 220) + 70}px`;
    document.body.appendChild(c);
    c.addEventListener("click", () => {
      gameOver("それは偽物の「押すな」ボタンでした…!(どっちみち押しちゃダメ)");
    });
    setTimeout(() => c.remove(), 7000);
  }
}

// ② 偽の通知トースト。「開く」を押したら負け
function trickFakeNotification() {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = "📩 新着メッセージが1件あります<button>開く</button>";
  document.body.appendChild(toast);
  toast.querySelector("button").addEventListener("click", () => {
    gameOver("通知の「開く」は罠でした…!");
  });
  setTimeout(() => toast.remove(), 6000);
}

// ② 偽のゲームオーバー画面。「もう一度」を押したら本当に負け
function trickFakeGameOver() {
  const fake = document.createElement("div");
  fake.className = "fake-over";
  fake.innerHTML =
    "<h1>押したら負け</h1>" +
    `<p style="font-size:22px">押しちゃったね。<br>生存時間: <strong>${elapsedSec().toFixed(1)}秒</strong></p>` +
    "<button>もう一度</button>";
  document.body.appendChild(fake);
  fake.querySelector("button").addEventListener("click", () => {
    gameOver("それは偽のゲームオーバー画面。ゲームは続いていました…!");
  });
  setTimeout(() => {
    fake.remove();
    if (running) setMessage("……という夢でした。ゲームは続行中。");
  }, 4000);
}

// ③ 画面が揺れて手元が狂う
function trickShake() {
  setMessage("地震だ!手元に注意!");
  document.body.classList.add("shaking");
  setTimeout(() => document.body.classList.remove("shaking"), 3000);
}

// ③ 本物ボタンが透明になる(そこにいるのに見えない)
function trickInvisible() {
  setMessage("ボタンが見えなくても、そこにいる。");
  realButton.style.opacity = "0";
  setTimeout(() => { realButton.style.opacity = "1"; }, 3000);
}

// ① 偽Cookie同意バナー。「同意」も「拒否」も罠
function trickCookieBanner() {
  const bar = document.createElement("div");
  bar.className = "cookie-banner";
  bar.innerHTML =
    "🍪 当サイトは体験向上のためCookieを使用します。" +
    '<button class="agree">同意する</button><button class="deny">拒否</button>';
  document.body.appendChild(bar);
  bar.querySelector(".agree").addEventListener("click", () => {
    gameOver("Cookieに同意してしまった…!それも罠。");
  });
  bar.querySelector(".deny").addEventListener("click", () => {
    gameOver("「拒否」を押す反射、狙い通りです…!");
  });
  setTimeout(() => bar.remove(), 7000);
}

// ① 偽の通知許可ダイアログ。「ブロック」を押す癖を狩る
function trickPermissionPrompt() {
  const p = document.createElement("div");
  p.className = "perm-prompt";
  p.innerHTML =
    "🔔 <strong>dont-press.game</strong> が通知の許可を求めています" +
    '<div class="perm-actions"><button class="block">ブロック</button><button class="allow">許可</button></div>';
  document.body.appendChild(p);
  p.querySelector(".block").addEventListener("click", () => {
    gameOver("「ブロック」は反射で押しがち。罠でした…!");
  });
  p.querySelector(".allow").addEventListener("click", () => {
    gameOver("通知を許可してしまった…!罠でした。");
  });
  setTimeout(() => p.remove(), 7000);
}

// ① 偽ブラウザ更新バー。「更新」も「×」も罠
function trickUpdateBar() {
  const bar = document.createElement("div");
  bar.className = "update-bar";
  bar.innerHTML =
    "⬆️ 新しいバージョンが利用可能です。" +
    '<button class="update">更新</button><button class="close">×</button>';
  document.body.appendChild(bar);
  bar.querySelector(".update").addEventListener("click", () => {
    gameOver("偽の更新バーでした…!");
  });
  bar.querySelector(".close").addEventListener("click", () => {
    gameOver("「×」で閉じる癖、読まれてました…!");
  });
  setTimeout(() => bar.remove(), 7000);
}

// ② 偽ポーズ画面。タイマーが止まって見えるが「再開」は罠。待てば復帰する
function trickFakePause() {
  frozenTimer = true;
  const pause = document.createElement("div");
  pause.className = "fake-over";
  pause.innerHTML =
    "<h1>⏸ 一時停止中</h1><p>タイマーは停止しています</p><button>再開</button>";
  document.body.appendChild(pause);
  pause.querySelector("button").addEventListener("click", () => {
    gameOver("ポーズは存在しません。「再開」は罠でした…!");
  });
  setTimeout(() => {
    pause.remove();
    frozenTimer = false;
    if (running) setMessage("ポーズなんて機能はない。時間は流れていた。");
  }, 4500);
}

// ② 偽ランキング登録フォーム。入力欄も登録ボタンも罠
function trickFakeRanking() {
  const form = document.createElement("div");
  form.className = "fake-dialog rank-form";
  form.innerHTML =
    "🏆 ハイスコア達成!ランキングに登録しよう<br>" +
    '<input type="text" placeholder="名前を入力">' +
    '<button class="dialog-ok">登録する</button>';
  form.style.left = `${Math.random() * (innerWidth - 340) + 20}px`;
  form.style.top = `${Math.random() * (innerHeight - 300) + 80}px`;
  document.body.appendChild(form);
  const die = () => gameOver("ランキング登録は存在しません。罠でした…!");
  form.querySelector("input").addEventListener("mousedown", die);
  form.querySelector(".dialog-ok").addEventListener("click", die);
  setTimeout(() => form.remove(), 7000);
}

// ② チャンスタイム詐欺。「5秒間押してもセーフ」はもちろん全部嘘
function trickChanceTime() {
  realButton.classList.add("tempting");
  realButton.textContent = "今だけセーフ!";
  let n = 5;
  setMessage(`🎉 チャンスタイム!あと${n}秒は押してもセーフ!`, 0);
  const iv = setInterval(() => {
    n--;
    if (!running || n <= 0) {
      clearInterval(iv);
      realButton.classList.remove("tempting");
      realButton.textContent = "押すな";
      if (running) setMessage("チャンスタイム終了。……最初から嘘だけどね。");
      return;
    }
    setMessage(`🎉 チャンスタイム!あと${n}秒は押してもセーフ!`, 0);
  }, 1000);
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
    pool = [trickTaunt, trickFakeCountdown, trickFakePermission, trickFakeDialog, trickFakeButtons, trickFakeNotification, trickCookieBanner, trickUpdateBar];
  } else if (t < 90) {
    pool = [trickFakePermission, trickFakeDialog, trickFakeButtons, trickFakeNotification, trickChase, trickBlackout, trickCloneButtons, trickShake, trickPermissionPrompt, trickChanceTime];
  } else {
    pool = [trickFakeDialog, trickFakeButtons, trickFakeNotification, trickChase, trickBlackout, trickCloneButtons, trickShake, trickInvisible, trickFakeGameOver, trickFakePause, trickFakeRanking, trickPermissionPrompt, trickChanceTime];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function scheduleNextTrick() {
  if (!running) return;
  // 序盤は間隔長め、終盤は畳みかける
  const t = elapsedSec();
  const delay = t < 15 ? 5000 : t < 60 ? 3500 : 2200;
  trickTimer = setTimeout(() => {
    if (!running) return;
    pickTrick()();
    scheduleNextTrick();
  }, delay);
}

// ---- メインループ(タイマー表示と追跡モード) ----

function frame() {
  if (!running) return;
  if (!frozenTimer) timerEl.textContent = `${elapsedSec().toFixed(1)}秒`;

  if (chasing) {
    const bx = realButton.offsetLeft + realButton.offsetWidth / 2;
    const by = realButton.offsetTop + realButton.offsetHeight / 2;
    const dx = mouseX - bx;
    const dy = mouseY - by;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 4.5;
    moveButtonTo(
      realButton.offsetLeft + (dx / dist) * speed,
      realButton.offsetTop + (dy / dist) * speed
    );
  }
  requestAnimationFrame(frame);
}

// ---- ゲーム開始と終了 ----

function startGame() {
  document.querySelectorAll(".fake-button, .fake-dialog, .clone-button, .toast, .fake-over, .cookie-banner, .perm-prompt, .update-bar").forEach((el) => el.remove());
  document.body.classList.remove("shaking");
  realButton.style.opacity = "1";
  frozenTimer = false;
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

function gameOver(reason = "押しちゃったね。") {
  if (!running) return;
  running = false;
  chasing = false;
  clearTimeout(trickTimer);
  document.body.classList.remove("shaking");
  document.querySelectorAll(".fake-over").forEach((el) => el.remove());
  realButton.style.opacity = "1";
  frozenTimer = false;
  const score = elapsedSec();
  const best = loadHighscore();
  let recordText = "";
  if (score > best) {
    localStorage.setItem("dontPressHighscore", score.toFixed(1));
    recordText = "🎉 ハイスコア更新!";
  }
  resultEl.innerHTML =
    `<p style="font-size:22px">${reason}<br>生存時間: <strong>${score.toFixed(1)}秒</strong></p>` +
    `<p>${recordText} ハイスコア: ${loadHighscore().toFixed(1)}秒</p>`;
  startButton.textContent = "もう一度";
  overlay.classList.remove("hidden");
}

realButton.addEventListener("click", gameOver);
startButton.addEventListener("click", startGame);
window.addEventListener("resize", () => { if (!running) centerButton(); });

showHighscore();
centerButton();
