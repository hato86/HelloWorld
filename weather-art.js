// 天気ジェネラティブアート
// 現在地の天気(気温・風速・風向・湿度・雲量・降水量)を粒子の動きと色に変換する。

const TOKYO = { latitude: 35.68, longitude: 139.76, label: "東京(フォールバック)" };

const canvas = document.getElementById("artCanvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const infoEl = document.getElementById("info");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// 現在地を取得。拒否・失敗時は東京にフォールバックする。
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(TOKYO);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        label: "現在地",
      }),
      () => resolve(TOKYO),
      { timeout: 8000 }
    );
  });
}

// Open-Meteo から現在の天気を取得する(APIキー不要)。
async function fetchWeather(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m" +
    "&timezone=auto";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`天気APIエラー: HTTP ${res.status}`);
  const data = await res.json();
  const c = data.current;
  return {
    temperature: c.temperature_2m,      // ℃
    humidity: c.relative_humidity_2m,   // %
    precipitation: c.precipitation,     // mm
    cloudCover: c.cloud_cover,          // %
    windSpeed: c.wind_speed_10m,        // km/h
    windDirection: c.wind_direction_10m, // 度(北=0、風が吹いてくる方角)
  };
}

// 天気の値を描画パラメータに変換する。
// 気温 → 色相(寒い=青 220°、暑い=赤 0°)
// 風速 → 粒子の速さ / 風向 → 流れる方向
// 湿度 → 粒子の大きさ / 雲量 → 背景の明るさ / 降水量 → 落下の強さ
function weatherToParams(w) {
  const t = Math.max(-10, Math.min(40, w.temperature));
  const hue = 220 - ((t + 10) / 50) * 220;
  // 風向は「吹いてくる方角」なので、粒子は反対向きに流れる
  const dirRad = ((w.windDirection + 180) % 360) * (Math.PI / 180);
  const speed = 0.5 + w.windSpeed * 0.15;
  return {
    hue,
    windX: Math.sin(dirRad) * speed,
    windY: -Math.cos(dirRad) * speed,
    particleSize: 1 + (w.humidity / 100) * 3,
    bgLightness: Math.round(18 - (w.cloudCover / 100) * 12), // 晴れ18% ← → 曇り6%
    fallSpeed: Math.min(w.precipitation * 2, 6),
    particleCount: 250,
  };
}

function createParticles(params) {
  const particles = [];
  for (let i = 0; i < params.particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: params.particleSize * (0.5 + Math.random()),
      hueJitter: (Math.random() - 0.5) * 40,
      drift: Math.random() * Math.PI * 2, // 個体ごとの揺らぎの位相
    });
  }
  return particles;
}

function animate(particles, params) {
  ctx.fillStyle = `hsla(230, 20%, ${params.bgLightness}%, 0.12)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    p.drift += 0.01;
    p.x += params.windX + Math.sin(p.drift) * 0.4;
    p.y += params.windY + params.fallSpeed + Math.cos(p.drift) * 0.4;

    // 画面外に出たら反対側から戻す
    if (p.x < 0) p.x += canvas.width;
    if (p.x > canvas.width) p.x -= canvas.width;
    if (p.y < 0) p.y += canvas.height;
    if (p.y > canvas.height) p.y -= canvas.height;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${params.hue + p.hueJitter}, 80%, 65%, 0.7)`;
    ctx.fill();
  }

  requestAnimationFrame(() => animate(particles, params));
}

function showInfo(location, w) {
  statusEl.textContent = `${location.label}の天気を使用中`;
  infoEl.innerHTML =
    `気温 ${w.temperature}℃ / 湿度 ${w.humidity}% / 風速 ${w.windSpeed}km/h` +
    `<br>風向 ${w.windDirection}° / 雲量 ${w.cloudCover}% / 降水量 ${w.precipitation}mm`;
}

async function main() {
  try {
    const location = await getLocation();
    statusEl.textContent = "天気を取得中…";
    const weather = await fetchWeather(location.latitude, location.longitude);
    showInfo(location, weather);
    const params = weatherToParams(weather);
    animate(createParticles(params), params);
  } catch (err) {
    statusEl.textContent = `エラー: ${err.message}`;
    infoEl.textContent = "天気を取得できませんでした。再読み込みしてください。";
  }
}

main();
