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
let fleeing = false;        // ボタンがカーソルから逃げるモード
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

// ③ 偽カーソルが4つ増える。どれが本物のカーソルか分からなくなる
function trickFakeCursors() {
  setMessage("カーソルが増えた!?本物はどれだ!");
  const offsets = [[120, 60], [-140, 90], [80, -110], [-90, -70]];
  const cursors = offsets.map(() => {
    const c = document.createElement("div");
    c.className = "fake-cursor";
    c.textContent = "➤";
    document.body.appendChild(c);
    return c;
  });
  const follow = (e) => {
    cursors.forEach((c, i) => {
      c.style.left = `${e.clientX + offsets[i][0]}px`;
      c.style.top = `${e.clientY + offsets[i][1]}px`;
    });
  };
  document.addEventListener("mousemove", follow);
  setTimeout(() => {
    document.removeEventListener("mousemove", follow);
    cursors.forEach((c) => c.remove());
  }, 6000);
}

// ③ 本物ボタンが巨大化して誤クリック域が激増する
function trickGiant() {
  setMessage("ボタンが巨大化!触れるな!");
  realButton.style.transition = "transform 1.2s";
  realButton.style.transform = "scale(3.2)";
  setTimeout(() => {
    realButton.style.transform = "scale(1)";
  }, 4500);
}

// ③ 偽の赤ボタンが雨のように降ってくる(全部罠)
function trickRain() {
  setMessage("ボタンの雨だ!よけろ!");
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      if (!running) return;
      const b = document.createElement("button");
      b.className = "clone-button";
      b.textContent = "押すな";
      b.style.left = `${Math.random() * (innerWidth - 160)}px`;
      b.style.top = "-80px";
      b.style.transition = `top ${2.5 + Math.random() * 2}s linear`;
      document.body.appendChild(b);
      b.addEventListener("click", () => {
        gameOver("降ってきたボタンに触れてしまった…!");
      });
      requestAnimationFrame(() => { b.style.top = `${innerHeight + 100}px`; });
      setTimeout(() => b.remove(), 5000);
    }, i * 350);
  }
}

// ① 偽ウイルス警告。「スキャン」も「無視」も罠
function trickVirus() {
  const d = document.createElement("div");
  d.className = "fake-dialog";
  d.style.background = "#ffe6e6";
  d.innerHTML =
    "🚨 <strong>警告: あなたのPCは危険にさらされています!</strong><br>" +
    "ウイルスが3件検出されました。" +
    '<button class="dialog-ok scan">今すぐスキャン</button>' +
    '<button class="dialog-ok" style="background:#888">無視する</button>';
  d.style.left = `${Math.random() * (innerWidth - 340) + 20}px`;
  d.style.top = `${Math.random() * (innerHeight - 280) + 80}px`;
  document.body.appendChild(d);
  d.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      gameOver("偽ウイルス警告に反応してしまった…!");
    })
  );
  setTimeout(() => d.remove(), 7000);
}

// ① 偽ダウンロード完了通知
function trickDownload() {
  const bar = document.createElement("div");
  bar.className = "dl-bar";
  bar.innerHTML = "📄 score_backup.zip を保存しました<button>開く</button>";
  document.body.appendChild(bar);
  bar.querySelector("button").addEventListener("click", () => {
    gameOver("そんなファイルはダウンロードされていません…!");
  });
  setTimeout(() => bar.remove(), 7000);
}

// ③ 画面が180度回転する
function trickFlip() {
  setMessage("世界が回る…!");
  document.body.classList.add("flipped");
  setTimeout(() => document.body.classList.remove("flipped"), 4000);
}

// ② 偽クラッシュ画面。「再読み込み」は罠。待てば復帰
function trickCrash() {
  const c = document.createElement("div");
  c.className = "fake-over";
  c.innerHTML =
    "<h1>⚠️ ゲームがクラッシュしました</h1>" +
    "<p>エラーコード: 0xDEAD_BUTTON</p>" +
    "<button>再読み込み</button>";
  document.body.appendChild(c);
  c.querySelector("button").addEventListener("click", () => {
    gameOver("クラッシュは演出。「再読み込み」は罠でした…!");
  });
  setTimeout(() => {
    c.remove();
    if (running) setMessage("クラッシュも嘘。よく我慢した。");
  }, 4000);
}

// ② ボタンが逃げ回って挑発してくる(追いかけてクリックしたら思うツボ)
function trickFlee() {
  setMessage("「押せるもんなら押してみな!」");
  fleeing = true;
  setTimeout(() => {
    fleeing = false;
    if (running) setMessage("……追いかけなかった?えらい。");
  }, 5000);
}

// ② 偽の勝利画面。「報酬を受け取る」は罠
function trickFakeWin() {
  const w = document.createElement("div");
  w.className = "fake-over";
  w.innerHTML =
    "<h1>🎉 おめでとう!</h1>" +
    "<p>勝利条件を達成しました。<br>報酬を受け取ってゲームを終了できます。</p>" +
    "<button>報酬を受け取る</button>";
  document.body.appendChild(w);
  w.querySelector("button").addEventListener("click", () => {
    gameOver("このゲームに勝利条件はありません。報酬も罠…!");
  });
  setTimeout(() => {
    w.remove();
    if (running) setMessage("勝利条件など最初からない。耐え続けろ。");
  }, 4000);
}

// ③ 画面の色が反転する
function trickInvert() {
  setMessage("目がおかしくなったわけじゃない。色が反転しただけ。");
  document.body.classList.add("inverted");
  setTimeout(() => document.body.classList.remove("inverted"), 3000);
}

// ② タイマーが巻き戻って見える(表示だけの嘘)
function trickRewind() {
  frozenTimer = true;
  let fake = elapsedSec();
  setMessage("!? 記録が巻き戻っている!?", 0);
  const iv = setInterval(() => {
    if (!running) { clearInterval(iv); return; }
    fake = Math.max(0, fake - 1.7);
    timerEl.textContent = `${fake.toFixed(1)}秒`;
  }, 100);
  setTimeout(() => {
    clearInterval(iv);
    frozenTimer = false;
    if (running) setMessage("表示だけの嘘でした。本当の記録は無事。");
  }, 5000);
}

// ---- 追加トリック: あからさま系(逆に騙す) ----

// 「正直に言う、これは罠」→3秒後に「嘘。実はボーナス」と言い出す(ずっと罠)
function trickHonestTrap() {
  const b = document.createElement("button");
  b.className = "clone-button fake-misc";
  b.style.background = "#8e44ad";
  b.style.borderColor = "#6c3483";
  b.textContent = "正直に言う。これは罠だ";
  b.style.left = `${Math.random() * (innerWidth - 300) + 20}px`;
  b.style.top = `${Math.random() * (innerHeight - 250) + 80}px`;
  document.body.appendChild(b);
  setTimeout(() => {
    if (b.isConnected) {
      b.textContent = "…は嘘。実は+30秒ボーナス";
      setMessage("さっきのは嘘らしいよ?どうする?");
    }
  }, 3000);
  b.addEventListener("click", () => {
    gameOver("「正直な罠」は最後まで罠でした…!");
  });
  setTimeout(() => b.remove(), 9000);
}

// 巨大矢印が本物を指して「PRESS HERE!!!」
function trickBigArrow() {
  realButton.classList.add("tempting");
  const arrow = document.createElement("div");
  arrow.className = "fake-misc";
  arrow.textContent = "⬇⬇⬇ PRESS HERE!!! ⬇⬇⬇";
  arrow.style.cssText =
    "position:absolute;font-size:34px;font-weight:bold;color:#ff0;pointer-events:none;z-index:4;text-shadow:0 0 12px #f00;";
  const place = () => {
    arrow.style.left = `${realButton.offsetLeft - 80}px`;
    arrow.style.top = `${realButton.offsetTop - 60}px`;
  };
  place();
  const iv = setInterval(() => {
    place();
    arrow.style.visibility = arrow.style.visibility === "hidden" ? "visible" : "hidden";
  }, 300);
  document.body.appendChild(arrow);
  setTimeout(() => {
    clearInterval(iv);
    arrow.remove();
    realButton.classList.remove("tempting");
    realButton.textContent = "押すな";
  }, 5000);
}

// 「このメッセージを読んだら負け」→「読んでません」ボタン
function trickReadTrap() {
  setMessage("⚠️ このメッセージを読んだら負けです。");
  setTimeout(() => {
    if (!running) return;
    const b = document.createElement("button");
    b.className = "fake-button fake-misc";
    b.textContent = "読んでません";
    b.style.left = `${innerWidth / 2 - 70}px`;
    b.style.top = `${innerHeight / 2 + 120}px`;
    document.body.appendChild(b);
    b.addEventListener("click", () => {
      gameOver("「読んでません」を押した時点で読んでますよね…!");
    });
    setTimeout(() => b.remove(), 6000);
  }, 1200);
}

// スロットが「あたり」を出してくる(仕込み)
function trickSlot() {
  const d = document.createElement("div");
  d.className = "fake-dialog fake-misc";
  d.innerHTML =
    '<div style="font-size:34px;text-align:center" class="slot">🎰</div>' +
    '<div style="text-align:center">回転中…</div>';
  d.style.left = `${Math.random() * (innerWidth - 340) + 20}px`;
  d.style.top = `${Math.random() * (innerHeight - 280) + 80}px`;
  document.body.appendChild(d);
  const slotEl = d.querySelector(".slot");
  const faces = ["🍒🍋⭐", "⭐🍒🍋", "🍋⭐🍒"];
  let i = 0;
  const iv = setInterval(() => {
    slotEl.textContent = faces[i++ % faces.length];
  }, 120);
  setTimeout(() => {
    clearInterval(iv);
    if (!d.isConnected) return;
    slotEl.textContent = "🍒🍒🍒";
    d.querySelector("div:last-child").innerHTML =
      'あたり!<button class="dialog-ok">賞金を受け取る</button>';
    d.querySelector(".dialog-ok").addEventListener("click", () => {
      gameOver("そのスロット、最初から仕込みです…!");
    });
  }, 2500);
  setTimeout(() => d.remove(), 9000);
}

// 画面中「PUSH! PUSH! PUSH!」の大合唱
function trickPushPush() {
  realButton.classList.add("tempting");
  const words = [];
  for (let i = 0; i < 10; i++) {
    const w = document.createElement("div");
    w.className = "fake-misc";
    w.textContent = "PUSH!";
    w.style.cssText =
      `position:absolute;left:${Math.random() * (innerWidth - 120)}px;top:${Math.random() * (innerHeight - 100) + 60}px;` +
      `font-size:${24 + Math.random() * 30}px;font-weight:bold;color:#ff5252;pointer-events:none;z-index:4;transform:rotate(${Math.random() * 40 - 20}deg);`;
    document.body.appendChild(w);
    words.push(w);
  }
  setTimeout(() => {
    words.forEach((w) => w.remove());
    realButton.classList.remove("tempting");
    realButton.textContent = "押すな";
    setMessage("圧に負けなかったか。");
  }, 4000);
}

// ---- 追加トリック: 初見殺し系 ----

// 右上にゲームUIのふりをした⚙設定アイコン
function trickFakeSettings() {
  const g = document.createElement("div");
  g.className = "fake-misc";
  g.textContent = "⚙";
  g.style.cssText =
    "position:fixed;top:12px;right:14px;font-size:26px;cursor:pointer;color:#99a;z-index:6;";
  document.body.appendChild(g);
  g.addEventListener("click", () => {
    gameOver("このゲームに設定画面はありません…!");
  });
  setTimeout(() => g.remove(), 9000);
}

// 「BGM: ON」のミュートアイコン(BGMなんて最初からない)
function trickMute() {
  setMessage("♪〜 ♪♪〜(うるさいBGMが流れている気がする)");
  const m = document.createElement("div");
  m.className = "fake-misc";
  m.textContent = "🔊 BGM: ON";
  m.style.cssText =
    "position:fixed;top:48px;right:14px;font-size:14px;cursor:pointer;color:#bbc;z-index:6;background:#22252e;padding:6px 10px;border-radius:6px;";
  document.body.appendChild(m);
  m.addEventListener("click", () => {
    gameOver("BGMなんて最初から流れていません…!");
  });
  setTimeout(() => m.remove(), 8000);
}

// 「実績解除まで99%」の完了ボタン
function trickProgress99() {
  const bar = document.createElement("div");
  bar.className = "dl-bar fake-misc";
  bar.innerHTML =
    '🏅 実績「鉄の意志」解除まで <strong>99%</strong>' +
    '<div style="background:#444;border-radius:4px;height:8px;margin:6px 0"><div style="background:#2ecc71;width:99%;height:8px;border-radius:4px"></div></div>' +
    "<button>完了する</button>";
  document.body.appendChild(bar);
  bar.querySelector("button").addEventListener("click", () => {
    gameOver("実績は勝手に解除されるもの。「完了する」は罠…!");
  });
  setTimeout(() => bar.remove(), 8000);
}

// カーソルの真下に無音でフェードインするボタン
function trickUnderCursor() {
  const b = document.createElement("button");
  b.className = "clone-button fake-misc";
  b.textContent = "押すな";
  b.style.left = `${mouseX - 70}px`;
  b.style.top = `${mouseY - 30}px`;
  b.style.opacity = "0";
  b.style.transition = "opacity 1.5s";
  document.body.appendChild(b);
  requestAnimationFrame(() => { b.style.opacity = "1"; });
  b.addEventListener("click", () => {
    gameOver("手元に湧いたボタンをうっかり…!");
  });
  setTimeout(() => b.remove(), 4500);
}

// 「Sキーで誘惑を停止できる」という嘘ヒント。Sを押したら負け
let keyTrapHandler = null;
function trickKeyTrap() {
  setMessage("💡 ヒント: Sキーを押すと誘惑を5秒間停止できます。", 0);
  keyTrapHandler = (e) => {
    if (e.key.toLowerCase() === "s") {
      gameOver("キーボードにも罠を仕掛けておきました…!");
    }
  };
  document.addEventListener("keydown", keyTrapHandler);
  setTimeout(() => {
    if (keyTrapHandler) {
      document.removeEventListener("keydown", keyTrapHandler);
      keyTrapHandler = null;
    }
    if (running) setMessage("Sキーを押さなかった?正解。あれも罠。");
  }, 6000);
}

// ---- 追加トリック: 自然すぎ系 ----

// 本物そっくりの偽「← もどる」リンク
function trickFakeBack() {
  const a = document.createElement("a");
  a.className = "fake-misc";
  a.href = "#";
  a.textContent = "← もどる";
  a.style.cssText =
    "position:fixed;bottom:10px;left:12px;color:#667;font-size:12px;z-index:11;";
  document.body.appendChild(a);
  a.addEventListener("click", (e) => {
    e.preventDefault();
    gameOver("その「もどる」は偽物。本物は右下です…!");
  });
  setTimeout(() => a.remove(), 10000);
}

// 煽りメッセージの下に小さな「[メッセージを閉じる]」
function trickMessageClose() {
  setMessage("この煽りメッセージ、目障りだよね。", 0);
  const x = document.createElement("a");
  x.className = "fake-misc";
  x.href = "#";
  x.textContent = "[メッセージを閉じる]";
  x.style.cssText =
    "position:fixed;top:140px;left:50%;transform:translateX(-50%);color:#888;font-size:12px;z-index:6;";
  document.body.appendChild(x);
  x.addEventListener("click", (e) => {
    e.preventDefault();
    gameOver("メッセージを閉じる機能などありません…!");
  });
  setTimeout(() => {
    x.remove();
    if (running) setMessage("");
  }, 7000);
}

// 「詳しいルールはこちら」リンク
function trickRulesLink() {
  const a = document.createElement("a");
  a.className = "fake-misc";
  a.href = "#";
  a.textContent = "詳しいルールはこちら";
  a.style.cssText =
    "position:fixed;bottom:12px;left:50%;transform:translateX(-50%);color:#5b8dd6;font-size:13px;z-index:6;";
  document.body.appendChild(a);
  a.addEventListener("click", (e) => {
    e.preventDefault();
    gameOver("ルールは「何も押すな」の一つだけ。リンクも罠…!");
  });
  setTimeout(() => a.remove(), 9000);
}

// 地味な「オートセーブ済み [手動保存]」UI
function trickAutosave() {
  const s = document.createElement("div");
  s.className = "fake-misc";
  s.innerHTML =
    '💾 オートセーブ済み: たった今 <button style="font-size:11px;padding:2px 8px;margin-left:4px;cursor:pointer">手動保存</button>';
  s.style.cssText =
    "position:fixed;bottom:36px;left:50%;transform:translateX(-50%);color:#778;font-size:12px;z-index:6;";
  document.body.appendChild(s);
  s.querySelector("button").addEventListener("click", () => {
    gameOver("セーブ機能はありません。地味なUIこそ怪しめ…!");
  });
  setTimeout(() => s.remove(), 9000);
}

// タイマー横の小さな「⟳」再計算アイコン
function trickHudRefresh() {
  const r = document.createElement("div");
  r.className = "fake-misc";
  r.textContent = "⟳";
  r.style.cssText =
    "position:fixed;top:16px;left:calc(50% + 90px);font-size:20px;color:#9aa;cursor:pointer;z-index:6;";
  r.title = "スコアを再計算";
  document.body.appendChild(r);
  r.addEventListener("click", () => {
    gameOver("スコアの再計算は不要です。それも罠…!");
  });
  setTimeout(() => r.remove(), 9000);
}

// ---- 追加トリック: 絶対に押してしまう系 ----

// 一定時間「画面のどこをクリックしてもアウト」にする共通装置
let clickTrapCleanup = null;
function armClickTrap(ms, reason, endMessage) {
  if (clickTrapCleanup) return false; // 二重発動はしない
  const handler = () => gameOver(reason);
  document.addEventListener("click", handler, true);
  const timeout = setTimeout(() => {
    disarm();
    if (running && endMessage) setMessage(endMessage);
  }, ms);
  function disarm() {
    document.removeEventListener("click", handler, true);
    clearTimeout(timeout);
    clickTrapCleanup = null;
  }
  clickTrapCleanup = disarm;
  return true;
}

// ⚡帯電: 3秒間、背景も含めて画面のどこに触れてもアウト(空打ち癖を狩る)
function trickElectrified() {
  if (!armClickTrap(3000, "⚡ 帯電中の画面に触れてしまった…!", "放電完了。触らなくて正解。")) {
    trickTaunt();
    return;
  }
  setMessage("⚡ 高圧電流が流れた!3秒間なにもクリックするな!背景もだ!", 0);
}

// カーソルが消える+「クリックで復帰」という嘘
function trickCursorGone() {
  if (!armClickTrap(4000, "「クリックで復帰」は嘘でした…!", "ほら、カーソルは勝手に戻る。")) {
    trickTaunt();
    return;
  }
  document.body.classList.add("nocursor");
  setMessage("カーソルが消えた!画面をクリックすれば復帰できるよ!", 0);
  setTimeout(() => document.body.classList.remove("nocursor"), 4000);
}

// 偽「タブが応答していません」バー
function trickTabHang() {
  const bar = document.createElement("div");
  bar.className = "update-bar fake-misc";
  bar.style.background = "#e8e8e8";
  bar.innerHTML =
    "⚠️ このページは応答していません。" +
    "<button>タブを閉じる</button><button>待機</button>";
  document.body.appendChild(bar);
  bar.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      gameOver("ページはずっと元気です。「応答なし」は演技…!");
    })
  );
  setTimeout(() => bar.remove(), 7000);
}

// 偽の友達チャット
function trickFakeChat() {
  const chat = document.createElement("div");
  chat.className = "toast fake-misc";
  chat.innerHTML =
    "💬 <strong>友達</strong>: まだやってるの?w 今何秒?<button>返信する</button>";
  document.body.appendChild(chat);
  chat.querySelector("button").addEventListener("click", () => {
    gameOver("友達などいません(このゲームには)。返信ボタンは罠…!");
  });
  setTimeout(() => chat.remove(), 7000);
}

// ギフト券当選詐欺(本物のカウントダウン付き)
function trickGiftCard() {
  const d = document.createElement("div");
  d.className = "fake-dialog fake-misc";
  d.style.background = "#fff8dc";
  d.innerHTML =
    "🎁 <strong>おめでとうございます!</strong><br>" +
    "ギフト券10,000円分に当選しました。<br>" +
    '<span class="gift-timer">残り10秒</span>' +
    '<button class="dialog-ok">受け取る</button>';
  d.style.left = `${Math.random() * (innerWidth - 340) + 20}px`;
  d.style.top = `${Math.random() * (innerHeight - 280) + 80}px`;
  document.body.appendChild(d);
  let n = 10;
  const iv = setInterval(() => {
    n--;
    const t = d.querySelector(".gift-timer");
    if (t) t.textContent = `残り${n}秒`;
    if (n <= 0) clearInterval(iv);
  }, 1000);
  d.querySelector(".dialog-ok").addEventListener("click", () => {
    gameOver("当選詐欺に引っかかった…!焦らせるカウントダウンは詐欺の定番。");
  });
  setTimeout(() => { clearInterval(iv); d.remove(); }, 10000);
}

// システムを名乗る検証命令。「罠ではありません」は罠の定番
function trickSystemOrder() {
  const d = document.createElement("div");
  d.className = "fake-dialog fake-misc";
  d.innerHTML =
    "🛡 <strong>【システム】</strong><br>" +
    "不正クリック検知の検証のため、下の緑のボタンを1回押してください。<br>" +
    "<em>※これは罠ではありません。</em>" +
    '<button class="dialog-ok" style="background:#2ecc71">検証ボタン</button>';
  d.style.left = `${innerWidth / 2 - 160}px`;
  d.style.top = `${innerHeight / 2 - 200}px`;
  document.body.appendChild(d);
  d.querySelector(".dialog-ok").addEventListener("click", () => {
    gameOver("「罠ではありません」と書いてあるものは、だいたい罠…!");
  });
  setTimeout(() => d.remove(), 7000);
}

// 本物のスタート画面と同じ見た目の偽画面
function trickFakeStartScreen() {
  const fake = document.createElement("div");
  fake.className = "fake-over fake-misc";
  fake.innerHTML =
    "<h1>押したら負け</h1>" +
    "<p>ルールはひとつ。<strong>何も押すな。</strong><br>" +
    "赤いボタンも、途中で現れる怪しいボタンも、ぜんぶ罠だ。<br>" +
    "画面はあの手この手で君にクリックさせようとしてくる。</p>" +
    "<button>はじめる</button>";
  document.body.appendChild(fake);
  fake.querySelector("button").addEventListener("click", () => {
    gameOver("それは偽のスタート画面。ゲームはずっと続いていた…!");
  });
  setTimeout(() => {
    fake.remove();
    if (running) setMessage("スタート画面に戻った?そんなわけない。");
  }, 4000);
}

// サーバーエラーのお詫び報酬
function trickApology() {
  const d = document.createElement("div");
  d.className = "fake-dialog fake-misc";
  d.innerHTML =
    "🙇 <strong>お詫び</strong><br>" +
    "先ほどサーバーエラーが発生しました。<br>お詫びとして記録に+20秒を進呈します。" +
    '<button class="dialog-ok">受け取る</button>';
  d.style.left = `${Math.random() * (innerWidth - 340) + 20}px`;
  d.style.top = `${Math.random() * (innerHeight - 280) + 80}px`;
  document.body.appendChild(d);
  d.querySelector(".dialog-ok").addEventListener("click", () => {
    gameOver("サーバーエラーは起きていません。お詫び報酬も罠…!");
  });
  setTimeout(() => d.remove(), 7000);
}

// パラドックス確認ダイアログ。「押しません」を押した時点で負け
function trickParadox() {
  const d = document.createElement("div");
  d.className = "fake-dialog fake-misc";
  d.innerHTML =
    "確認: 本当に何も押しませんか?" +
    '<button class="dialog-ok">はい、押しません</button>' +
    '<button class="dialog-ok" style="background:#888">いいえ</button>';
  d.style.left = `${Math.random() * (innerWidth - 340) + 20}px`;
  d.style.top = `${Math.random() * (innerHeight - 260) + 80}px`;
  document.body.appendChild(d);
  d.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      gameOver("「押しません」を押した時点で、押してます…!");
    })
  );
  setTimeout(() => d.remove(), 7000);
}

// 全画面表示のおすすめ
function trickFullscreen() {
  const bar = document.createElement("div");
  bar.className = "update-bar fake-misc";
  bar.innerHTML =
    "🖥 全画面表示にすると、より快適にプレイできます。<button>全画面にする</button>";
  document.body.appendChild(bar);
  bar.querySelector("button").addEventListener("click", () => {
    gameOver("快適になるのは罠のほうでした…!");
  });
  setTimeout(() => bar.remove(), 7000);
}

// 本物ボタンが0.4秒ごとに瞬間移動して暴れる
function trickTeleportSpam() {
  setMessage("ボタンが暴走した!むやみに動くな!");
  let count = 0;
  const iv = setInterval(() => {
    if (!running || count >= 10) { clearInterval(iv); return; }
    moveButtonTo(
      Math.random() * (innerWidth - 200),
      Math.random() * (innerHeight - 220) + 70
    );
    count++;
  }, 400);
}

// ---- 追加トリック: ハッキング演出系(すべて演出。実際には何もしない) ----

const origTitle = document.title;

// 偽ブルースクリーン
function trickBSOD() {
  const b = document.createElement("div");
  b.className = "fake-over fake-misc";
  b.style.background = "#0078d7";
  b.innerHTML =
    '<div style="font-size:72px">:(</div>' +
    "<p>PCで問題が発生したため、再起動する必要があります。<br>" +
    "エラー: BUTTON_PRESSURE_OVERFLOW</p>" +
    "<button>今すぐ再起動する</button>";
  document.body.appendChild(b);
  b.querySelector("button").addEventListener("click", () => {
    gameOver("ブルースクリーンは偽物。「再起動」は罠でした…!");
  });
  setTimeout(() => {
    b.remove();
    if (running) setMessage("PCは無事です。焦った?");
  }, 5000);
}

// 偽ハッキングターミナル
function trickHackTerminal() {
  const t = document.createElement("div");
  t.className = "fake-over fake-misc";
  t.style.cssText += "background:#000;justify-content:flex-start;align-items:flex-start;padding:30px;font-family:monospace;color:#0f0;font-size:14px;text-align:left;";
  const log = document.createElement("pre");
  log.style.cssText = "margin:0;white-space:pre-wrap;";
  t.appendChild(log);
  const stopBtn = document.createElement("button");
  stopBtn.textContent = "緊急停止";
  stopBtn.style.cssText = "margin-top:20px;background:#c0392b;";
  t.appendChild(stopBtn);
  document.body.appendChild(t);
  const lines = [
    "> CONNECTING TO dont-press.game ...",
    "> ACCESS GRANTED",
    "> READING localStorage ...",
    "> FOUND: dontPressHighscore",
    "> UPLOADING YOUR HIGHSCORE TO ...",
  ];
  let i = 0;
  const iv = setInterval(() => {
    if (!t.isConnected || i >= lines.length) { clearInterval(iv); return; }
    log.textContent += lines[i++] + "\n";
  }, 600);
  stopBtn.addEventListener("click", () => {
    gameOver("「緊急停止」を押させるための演出でした…!");
  });
  setTimeout(() => {
    clearInterval(iv);
    t.remove();
    if (running) setMessage("ハッキング?してませんよ。全部演出。");
  }, 6000);
}

// タブタイトル乗っ取り(本当にタブ名が変わる)
function trickTitleHijack() {
  const titles = ["⚠️ ハッキング検出", "助けて", "(1) 至急確認してください"];
  let i = 0;
  const iv = setInterval(() => {
    document.title = titles[i++ % titles.length];
  }, 800);
  const fix = document.createElement("button");
  fix.className = "fake-button fake-misc";
  fix.textContent = "タブを修復する";
  fix.style.left = `${innerWidth / 2 - 70}px`;
  fix.style.top = "60px";
  document.body.appendChild(fix);
  fix.addEventListener("click", () => {
    gameOver("タブは勝手に直ります。「修復」は罠…!");
  });
  setTimeout(() => {
    clearInterval(iv);
    document.title = origTitle;
    fix.remove();
    if (running) setMessage("タブ、勝手に直ったでしょ?");
  }, 6000);
}

// 偽ファイル削除の進行バー
function trickFileDelete() {
  const bar = document.createElement("div");
  bar.className = "dl-bar fake-misc";
  bar.innerHTML =
    '🗑 C:\\Users\\あなた\\写真 を削除中… <span class="del-pct">0%</span>' +
    '<div style="background:#444;border-radius:4px;height:8px;margin:6px 0"><div class="del-fill" style="background:#e74c3c;width:0%;height:8px;border-radius:4px"></div></div>' +
    "<button>キャンセル</button>";
  document.body.appendChild(bar);
  let pct = 0;
  const iv = setInterval(() => {
    if (!bar.isConnected) { clearInterval(iv); return; }
    pct = Math.min(100, pct + Math.floor(Math.random() * 9) + 3);
    bar.querySelector(".del-pct").textContent = `${pct}%`;
    bar.querySelector(".del-fill").style.width = `${pct}%`;
    if (pct >= 100) {
      clearInterval(iv);
      bar.innerHTML = "🗑 削除完了……は嘘。何も消していません。";
      setTimeout(() => bar.remove(), 2500);
    }
  }, 500);
  bar.querySelector("button").addEventListener("click", () => {
    gameOver("削除なんて最初からしていません。「キャンセル」が罠…!");
  });
  setTimeout(() => { clearInterval(iv); bar.remove(); }, 12000);
}

// ハイスコア人質
function trickHostageScore() {
  highscoreEl.textContent = "ハイスコア: ?????";
  setMessage("ハイスコアは預かった。返してほしければボタンを押せ。", 0);
  const b = document.createElement("button");
  b.className = "fake-button fake-misc";
  b.textContent = "ハイスコアを取り返す";
  b.style.left = `${innerWidth / 2 - 90}px`;
  b.style.top = `${innerHeight / 2 + 150}px`;
  document.body.appendChild(b);
  b.addEventListener("click", () => {
    gameOver("人質交渉に応じてしまった…!ハイスコアは無事なのに。");
  });
  setTimeout(() => {
    b.remove();
    showHighscore();
    if (running) setMessage("ハイスコアは最初から無事。交渉に応じないのが正解。");
  }, 5500);
}

// PLAYER2乱入。偽カーソルが勝手に本物ボタンへ向かう
function trickPlayer2() {
  setMessage("⚠️ PLAYER2が参加した!あなたの代わりに押そうとしている!", 0);
  const p2 = document.createElement("div");
  p2.className = "fake-cursor fake-misc";
  p2.innerHTML = '➤<span style="font-size:11px;color:#f66"> PLAYER2</span>';
  p2.style.color = "#f66";
  let px = Math.random() * innerWidth;
  let py = -30;
  document.body.appendChild(p2);
  const block = document.createElement("button");
  block.className = "fake-button fake-misc";
  block.textContent = "PLAYER2をブロック";
  block.style.left = `${innerWidth / 2 - 80}px`;
  block.style.top = "60px";
  document.body.appendChild(block);
  block.addEventListener("click", () => {
    gameOver("PLAYER2は幻。「ブロック」を押したあなたが本物…!");
  });
  const iv = setInterval(() => {
    if (!p2.isConnected) { clearInterval(iv); return; }
    const tx = realButton.offsetLeft + realButton.offsetWidth / 2;
    const ty = realButton.offsetTop - 20;
    px += (tx - px) * 0.04;
    py += (ty - py) * 0.04;
    p2.style.left = `${px}px`;
    p2.style.top = `${py}px`;
  }, 50);
  setTimeout(() => {
    clearInterval(iv);
    p2.remove();
    block.remove();
    if (running) setMessage("PLAYER2は押す勇気がなくて帰りました。");
  }, 7000);
}

// タイマーが文字化けして暴れる
function trickGlitchTimer() {
  frozenTimer = true;
  const glitch = ["H4CK3D", "3RR0R", "??.?秒", "-999秒", "▓▓▓▓"];
  const iv = setInterval(() => {
    if (!running) { clearInterval(iv); return; }
    timerEl.textContent = glitch[Math.floor(Math.random() * glitch.length)];
  }, 150);
  const b = document.createElement("button");
  b.className = "fake-button fake-misc";
  b.textContent = "システム復元";
  b.style.left = `${innerWidth / 2 - 60}px`;
  b.style.top = "60px";
  document.body.appendChild(b);
  b.addEventListener("click", () => {
    gameOver("タイマーは表示が乱れただけ。「復元」は罠…!");
  });
  setTimeout(() => {
    clearInterval(iv);
    frozenTimer = false;
    b.remove();
    if (running) setMessage("タイマー復旧。内部の記録はずっと正常でした。");
  }, 5000);
}

// 逃げ回る「閉じる」ボタン
function trickRunawayClose() {
  const d = document.createElement("div");
  d.className = "fake-dialog fake-misc";
  d.innerHTML = "このウィンドウは閉じられません(笑)";
  d.style.left = `${Math.random() * (innerWidth - 340) + 20}px`;
  d.style.top = `${Math.random() * (innerHeight - 260) + 80}px`;
  document.body.appendChild(d);
  const x = document.createElement("button");
  x.className = "fake-button fake-misc";
  x.textContent = "× 閉じる";
  x.style.left = `${parseFloat(d.style.left) + 240}px`;
  x.style.top = `${parseFloat(d.style.top) - 14}px`;
  document.body.appendChild(x);
  x.addEventListener("mouseover", () => {
    x.style.left = `${Math.random() * (innerWidth - 120)}px`;
    x.style.top = `${Math.random() * (innerHeight - 120) + 60}px`;
  });
  x.addEventListener("click", () => {
    gameOver("逃げる×ボタンを執念で捕まえた…その執念が命取り!");
  });
  setTimeout(() => { d.remove(); x.remove(); }, 8000);
}

// 偽パスワード送信(勝手にタイプされていく)
function trickPasswordSteal() {
  const d = document.createElement("div");
  d.className = "fake-dialog fake-misc";
  d.innerHTML =
    "🔑 パスワードを送信しています…<br>" +
    '<input type="text" class="pw" readonly style="width:85%;margin:10px auto;display:block;padding:8px;font-size:14px">' +
    '<button class="dialog-ok">送信を止める</button>';
  d.style.left = `${Math.random() * (innerWidth - 340) + 20}px`;
  d.style.top = `${Math.random() * (innerHeight - 280) + 80}px`;
  document.body.appendChild(d);
  const input = d.querySelector(".pw");
  const iv = setInterval(() => {
    if (!d.isConnected || input.value.length >= 14) { clearInterval(iv); return; }
    input.value += "●";
  }, 300);
  d.querySelector(".dialog-ok").addEventListener("click", () => {
    gameOver("あなたのパスワードなんて知りません。「止める」が罠…!");
  });
  setTimeout(() => {
    clearInterval(iv);
    d.remove();
    if (running) setMessage("送信先なんてない。ただの●でした。");
  }, 7000);
}

// 偽の再起動カウントダウン(本物のカウント付き)
function trickRebootCountdown() {
  const d = document.createElement("div");
  d.className = "fake-dialog fake-misc";
  d.innerHTML =
    '🔄 システムは <strong class="reboot-n">10</strong> 秒後に再起動します。' +
    '<button class="dialog-ok">キャンセル</button>';
  d.style.left = `${innerWidth / 2 - 160}px`;
  d.style.top = `${innerHeight / 2 - 220}px`;
  document.body.appendChild(d);
  let n = 10;
  const iv = setInterval(() => {
    if (!d.isConnected) { clearInterval(iv); return; }
    n--;
    d.querySelector(".reboot-n").textContent = n;
    if (n <= 0) {
      clearInterval(iv);
      d.innerHTML = "🔄 再起動……しません(笑)";
      setTimeout(() => d.remove(), 2500);
    }
  }, 1000);
  d.querySelector(".dialog-ok").addEventListener("click", () => {
    gameOver("再起動なんて起きない。「キャンセル」が罠…!");
  });
  setTimeout(() => { clearInterval(iv); d.remove(); }, 14000);
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
    pool = [trickTaunt, trickFakeCountdown, trickFakePermission, trickFakeDialog, trickFakeButtons, trickFakeNotification, trickCookieBanner, trickUpdateBar, trickDownload, trickVirus,
      trickHonestTrap, trickFakeSettings, trickMute, trickRulesLink, trickAutosave];
  } else if (t < 90) {
    pool = [trickFakePermission, trickFakeDialog, trickFakeButtons, trickFakeNotification, trickChase, trickBlackout, trickCloneButtons, trickShake, trickPermissionPrompt, trickChanceTime, trickGiant, trickFlee, trickRain, trickInvert,
      trickBigArrow, trickReadTrap, trickSlot, trickPushPush, trickProgress99, trickFakeBack, trickMessageClose, trickHudRefresh,
      trickGiftCard, trickFakeChat, trickFullscreen, trickTabHang,
      trickTitleHijack, trickFileDelete, trickRebootCountdown];
  } else {
    pool = [trickFakeDialog, trickFakeButtons, trickFakeNotification, trickChase, trickBlackout, trickCloneButtons, trickShake, trickInvisible, trickFakeGameOver, trickFakePause, trickFakeRanking, trickPermissionPrompt, trickChanceTime, trickGiant, trickFlee, trickRain, trickInvert, trickFakeCursors, trickFlip, trickCrash, trickFakeWin, trickRewind,
      trickHonestTrap, trickBigArrow, trickReadTrap, trickSlot, trickPushPush, trickProgress99, trickUnderCursor, trickKeyTrap, trickFakeBack, trickMessageClose, trickRulesLink, trickAutosave, trickHudRefresh,
      trickGiftCard, trickFakeChat, trickFullscreen, trickTabHang, trickElectrified, trickCursorGone, trickSystemOrder, trickFakeStartScreen, trickApology, trickParadox, trickTeleportSpam,
      trickBSOD, trickHackTerminal, trickTitleHijack, trickFileDelete, trickHostageScore, trickPlayer2, trickGlitchTimer, trickRunawayClose, trickPasswordSteal, trickRebootCountdown];
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

  if (chasing || fleeing) {
    const bx = realButton.offsetLeft + realButton.offsetWidth / 2;
    const by = realButton.offsetTop + realButton.offsetHeight / 2;
    const dx = mouseX - bx;
    const dy = mouseY - by;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 4.5;
    const dir = chasing ? 1 : -1; // 追跡は近づき、逃走は離れる
    if (!(fleeing && dist > 350)) {
      moveButtonTo(
        realButton.offsetLeft + (dx / dist) * speed * dir,
        realButton.offsetTop + (dy / dist) * speed * dir
      );
    }
  }
  requestAnimationFrame(frame);
}

// ---- ゲーム開始と終了 ----

function startGame() {
  document.querySelectorAll(".fake-button, .fake-dialog, .clone-button, .toast, .fake-over, .cookie-banner, .perm-prompt, .update-bar, .dl-bar, .fake-cursor, .fake-misc").forEach((el) => el.remove());
  document.body.classList.remove("shaking", "flipped", "inverted");
  realButton.style.opacity = "1";
  realButton.style.transform = "";
  frozenTimer = false;
  fleeing = false;
  if (keyTrapHandler) {
    document.removeEventListener("keydown", keyTrapHandler);
    keyTrapHandler = null;
  }
  if (clickTrapCleanup) clickTrapCleanup();
  document.body.classList.remove("nocursor");
  document.title = origTitle;
  showHighscore();
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
  document.body.classList.remove("shaking", "flipped", "inverted");
  document.querySelectorAll(".fake-over, .fake-cursor, .fake-misc").forEach((el) => el.remove());
  realButton.style.opacity = "1";
  realButton.style.transform = "";
  frozenTimer = false;
  fleeing = false;
  if (keyTrapHandler) {
    document.removeEventListener("keydown", keyTrapHandler);
    keyTrapHandler = null;
  }
  if (clickTrapCleanup) clickTrapCleanup();
  document.body.classList.remove("nocursor");
  document.title = origTitle;
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
