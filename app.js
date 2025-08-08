// 課題①：時刻に応じたあいさつ（ページ読み込み時に実行）
window.addEventListener("DOMContentLoaded", () => {
  const hour = new Date().getHours();
  let greeting;

  if (hour < 12) {
    greeting = "おはようございます！";
  } else if (hour < 18) {
    greeting = "こんにちは！";
  } else {
    greeting = "こんばんは！";
  }

  document.getElementById("greeting").textContent = greeting;
});

// 課題②＋③：ボタンを押すと背景色変更＋スキル追加
const colors = ["#f0f8ff", "#ffe4e1", "#e0ffff", "#fafad2", "#d8bfd8"];
let index = 0;

document.getElementById("changeTextButton").addEventListener("click", () => {
  // 背景色変更（課題②）
  document.body.style.backgroundColor = colors[index % colors.length];
  index++;

  // 自己紹介スキル追加（課題③）
  const newItem = document.createElement("li");
  newItem.textContent = "新しいスキル：JavaScript!";
  document.querySelector("ul").appendChild(newItem);
});
