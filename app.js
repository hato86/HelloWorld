// 課題①：時刻に応じたあいさつ
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

// 課題②＋③：ボタンで背景色変更＋スキル追加（1回だけ）
const colors = ["#f0f8ff", "#ffe4e1", "#e0ffff", "#fafad2", "#d8bfd8"];
let index = 0;
let skillAdded = false;

document.getElementById("changeTextButton").addEventListener("click", () => {
  // 背景色変更
  document.body.style.backgroundColor = colors[index % colors.length];
  index++;

  // スキル追加（1回だけ）
  if (!skillAdded) {
    const newItem = document.createElement("li");
    newItem.textContent = "新しいスキル：JavaScript!";
    document.querySelector("ul").appendChild(newItem);
    skillAdded = true;
  }
});
