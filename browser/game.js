"use strict";
// Cerune owns every movement, collision and progression event.
// The browser only scales and draws the returned 7x6 map and presents controls.
const game = document.querySelector("#game");
const canvas = document.querySelector("#map");
const ctx = canvas.getContext("2d");
const story = document.querySelector("#story");
const dialogue = document.querySelector("#dialogue");
const journal = document.querySelector("#journal");
const menu = document.querySelector("#menu");
const scrim = document.querySelector("#menu-scrim");
const toggle = document.querySelector("#menu-toggle");
const touch = document.querySelector("#touch-controls");
const errorBox = document.querySelector("#error");
const TILE = 80;
const MAP_WIDTH = 7 * TILE;
const MAP_HEIGHT = 6 * TILE;
const messages = {
  start: "昨夜、星がひとつ消えた。\n村の橋を覚えているのは、誰？",
  moved: "小道を歩く。風が草を揺らしている。",
  blocked: "この先へは進めないようだ。",
  nothing: "今は何も見つからない。",
  met_lyuna: "リュナ「昨日まで、ここには橋があったの。覚えている？」\n「誰も覚えていない。星のランタンを持っていって」",
  already_met: "リュナ「光を追って。私はあなたを覚えているから」",
  need_lantern: "冷たい光が揺れている。まずリュナに話そう。",
  found_shard: "ランタンが草むらの星の欠片を照らした。\n声がささやく。「約束は川の向こうに残っている」",
  already_found: "星の欠片は手元にある。",
  need_shard: "ビーコンは沈黙している。落ちた星が必要だ。",
  bridge_restored: "星の欠片がビーコンを目覚めさせた。\n忘れられた橋が戻ってきた。",
  already_restored: "ビーコンは静かに輝いている。",
  found_diary: "家の中には古い日記があった。\n最初のページには、あなた自身の名前。\n第1章クリア。",
  already_finished: "第1章はクリア済み。",
  invalid: "操作を読み取れなかった。"
};
// The Cerune map is only semantic data. All artwork below is presentation.
const SCENE_W = MAP_WIDTH, SCENE_H = MAP_HEIGHT;
const palette = {
  moss: "#294d43", grass: "#3e6d51", path: "#ac9d78", pathEdge: "#777956",
  treeShadow: "#163f3a", leaf: "#386f54", leafLight: "#60966c",
  gold: "#ffe0a0", water: "#377b89"
};
function random2(x, y, salt = 0) {
  let n = (Math.imul(x + 31, 374761393) + Math.imul(y + 19, 668265263) +
    Math.imul(salt + 7, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function disk(x, y, r, color, ry = r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function stroke(x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function routeTile(c) {
  return c !== "#" && c !== "~" && c !== "=";
}
function forestFloor() {
  const ground = ctx.createLinearGradient(0, 0, SCENE_W, SCENE_H);
  ground.addColorStop(0, "#426b55");
  ground.addColorStop(0.58, "#385b4e");
  ground.addColorStop(1, "#264c48");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  // Seeded details do not jump between frames.
  for (let i = 0; i < 540; i++) {
    const x = random2(i, 1) * SCENE_W;
    const y = random2(i, 2) * SCENE_H;
    const r = 2 + random2(i, 3) * 9;
    disk(x, y, r, i % 4 === 0 ? "#60836045" : "#1f51454d", r * 0.56);
    if (i % 6 === 0) {
      stroke(x - 2, y + 2, x - 4, y - 4, 1, "#91ad7b");
      stroke(x, y + 2, x + 3, y - 5, 1, "#91ad7b");
    }
  }
}
function paths(rows) {
  // Rounded strokes connect adjacent traversable cells without drawing grid squares.
  const draw = (width, color) => {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      if (!routeTile(rows[y][x])) continue;
      const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
      disk(cx, cy, width * 0.47, color);
      if (x + 1 < rows[y].length && routeTile(rows[y][x + 1])) {
        stroke(cx, cy, cx + TILE, cy, width, color);
      }
      if (y + 1 < rows.length && routeTile(rows[y + 1][x])) {
        stroke(cx, cy, cx, cy + TILE, width, color);
      }
    }
  };
  draw(67, palette.pathEdge);
  draw(55, palette.path);
  // Dirt flecks and cobbles on walkable ground.
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    if (!routeTile(rows[y][x])) continue;
    for (let i = 0; i < 9; i++) {
      const px = (x + 0.5) * TILE + (random2(x * 19 + i, y, 4) - 0.5) * 45;
      const py = (y + 0.5) * TILE + (random2(x, y * 31 + i, 5) - 0.5) * 45;
      disk(px, py, 1 + random2(i, x + y, 7) * 2, i % 2 ? "#d0be925c" : "#746c5860", 1.4);
    }
  }
}
function tree(x, y, seed) {
  disk(x + 2, y + 17, 31, "#132d304e", 14);
  ctx.fillStyle = "#614f3a";
  ctx.fillRect(x - 5, y - 1, 10, 28);
  disk(x - 16, y - 7, 22, "#255747");
  disk(x + 17, y - 8, 25, "#2a6049");
  disk(x, y - 22, 29, seed % 3 ? palette.leaf : "#326551");
  disk(x - 9, y - 29, 13, palette.leafLight, 10);
  disk(x + 12, y - 18, 12, "#4a8263", 10);
  for (let k = 0; k < 3; k++) {
    disk(x - 17 + random2(seed, k) * 32, y - 32 + random2(k, seed) * 18,
      2, "#a7c78c");
  }
}
function river(x, y, bridged) {
  ctx.fillStyle = "#254d54";
  ctx.beginPath();
  ctx.ellipse(x, y, 36, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  disk(x, y, 30, palette.water, 36);
  for (let i = 0; i < 4; i++) {
    const cy = y - 23 + i * 15;
    stroke(x - 17 + i % 2 * 8, cy, x + 12 + i % 2 * 7, cy - 2, 2, "#aad2ce8b");
  }
  if (bridged) {
    ctx.fillStyle = "#5d4235";
    ctx.fillRect(x - 36, y - 25, 72, 50);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? "#c69b60" : "#aa7c4a";
      ctx.fillRect(x - 34 + i * 14, y - 23, 12, 46);
    }
    stroke(x - 36, y - 27, x + 36, y - 27, 5, "#e1b778");
    stroke(x - 36, y + 27, x + 36, y + 27, 5, "#e1b778");
  }
}
function beacon(x, y, lit) {
  disk(x + 3, y + 18, 19, "#1b2f2a77", 10);
  ctx.fillStyle = "#5a6262";
  ctx.fillRect(x - 8, y - 4, 16, 27);
  ctx.fillStyle = "#9d9d8d";
  ctx.fillRect(x - 13, y + 13, 26, 10);
  disk(x, y - 16, lit ? 19 : 11, lit ? "#f8d47b55" : "#9badad55");
  disk(x, y - 17, lit ? 8 : 6, lit ? "#ffeb9f" : "#85979a");
}
function cottage(x, y) {
  disk(x, y + 27, 32, "#1f343555", 14);
  ctx.fillStyle = "#d5b58a";
  ctx.fillRect(x - 25, y - 14, 50, 47);
  ctx.fillStyle = "#a65b50";
  ctx.beginPath();
  ctx.moveTo(x - 33, y - 13);
  ctx.lineTo(x, y - 41);
  ctx.lineTo(x + 33, y - 13);
  ctx.closePath();
  ctx.fill();
  stroke(x - 34, y - 14, x + 34, y - 14, 4, "#6f4240");
  ctx.fillStyle = "#513c39";
  ctx.fillRect(x - 7, y + 8, 14, 25);
  ctx.fillStyle = "#f5db9b";
  ctx.fillRect(x - 21, y - 3, 10, 12);
}
function character(x, y, cloak, hair) {
  disk(x + 2, y + 18, 15, "#0d252856", 7);
  // These shapes sit on top of terrain; never paint a background square.
  ctx.fillStyle = "#483b3c";
  ctx.fillRect(x - 8, y + 9, 6, 11);
  ctx.fillRect(x + 3, y + 9, 6, 11);
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 3);
  ctx.lineTo(x + 12, y - 3);
  ctx.lineTo(x + 14, y + 12);
  ctx.lineTo(x - 14, y + 12);
  ctx.closePath();
  ctx.fill();
  disk(x, y - 11, 10, "#f0c99b");
  disk(x, y - 17, 10, hair, 6);
  ctx.fillStyle = "#372d38";
  ctx.fillRect(x - 5, y - 10, 2, 2);
  ctx.fillRect(x + 4, y - 10, 2, 2);
  ctx.fillStyle = "#f7e3bf";
  ctx.fillRect(x - 7, y + 2, 4, 7);
}
function shard(x, y) {
  disk(x, y + 5, 22, "#f9dfa435");
  ctx.fillStyle = "#fce0a2";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 - Math.PI / 2;
    const r = i % 2 ? 5 : 16;
    if (i === 0) ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    else ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  disk(x, y, 3, "#fff7df");
}
function props(rows) {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const c = rows[y][x], cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
    if (c === "#") {
      tree(cx + (random2(x, y) - 0.5) * 16, cy + (random2(y, x) - 0.5) * 12, y * 7 + x);
    } else if (c === "L") drawSprite("lyuna", cx, cy + 8, "down", false);
    else if (c === "*") shard(cx, cy);
    else if (c === "B" || c === "+") beacon(cx, cy, c === "+");
    else if (c === "H") cottage(cx, cy);
    else if (c === "~" || c === "=") river(cx, cy, c === "=");
  }
}
function hero(x, y) {
  character(x, y, "#345f99", "#6a4d3c");
}


// Original bundled 4x4 frame sheets. SVG is local-only and cannot affect game rules.
const sprites = {hero: new Image(), lyuna: new Image()};
const appearanceKey = "stelle.hero.appearance.v1";
const scaleKey = "stelle.sprite.scale.v1";
let spriteScale = {hero: 120, lyuna: 100};
try { const data=JSON.parse(localStorage.getItem(scaleKey) || "{}"); for (const name of ["hero","lyuna"]) if(Number.isInteger(data[name]) && data[name]>=70 && data[name]<=160) spriteScale[name]=data[name]; } catch { /* storage is optional */ }
function savedAppearance() {
  try { return localStorage.getItem(appearanceKey) === "girl" ? "girl" : "boy"; }
  catch { return "boy"; }
}
let heroAppearance = savedAppearance();
function heroAsset() { return "/assets/hero-" + heroAppearance + ".png"; }
const ready = {hero: false, lyuna: false};
for (const name of Object.keys(sprites)) {
  sprites[name].addEventListener("load", () => {
    ready[name] = true;
    draw();
  });
  sprites[name].addEventListener("error", () => {
    ready[name] = false;
    if (name === "hero" && !sprites.hero.src.endsWith(".svg")) {
      sprites.hero.src = "/assets/hero-" + heroAppearance + ".svg";
    }
    draw();
  });
  sprites[name].src = name === "lyuna" ? "/assets/lyuna.png" : heroAsset();
}
let facing = "down";
let stride = 0;
let lastMove = 0;
let previousX = null;
let previousY = null;
const facingRows = {down: 0, left: 1, right: 2, up: 3};
function drawSprite(name, x, y, direction, walking) {
  if (!ready[name]) {
    if (name === "hero") hero(x, y);
    else character(x, y, "#985f84", "#ad7d58");
    return;
  }
  const frame = walking && name === "hero" ? Math.floor(stride) % 4 : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const isLyuna = name === "lyuna";
  const heroPng = !isLyuna && sprites.hero.src.endsWith(".png");
  const cellW = isLyuna || heroPng ? 96 : 64;
  const cellH = isLyuna || heroPng ? 96 : 80;
  const col = isLyuna && walking ? Math.floor(stride) % 4 : frame;
  const naturalW = isLyuna || heroPng ? 53 : 42;
  const naturalH = isLyuna || heroPng ? 53 : 53;
  const factor = spriteScale[name] / 100;
  const destW = naturalW * factor;
  const destH = naturalH * factor;
  ctx.drawImage(sprites[name], col * cellW, facingRows[direction] * cellH, cellW, cellH,
    Math.round(x - destW / 2), Math.round(y - destH + 19), destW, destH);
  ctx.restore();
}

let current = null;
let busy = false;
let menuOpen = false;
let dismissTimer;
const held = new Set();
let movementTimer;
const noteworthy = new Set([
  "start", "met_lyuna", "already_met", "need_lantern",
  "found_shard", "already_found", "need_shard", "bridge_restored",
  "already_restored", "found_diary", "already_finished", "nothing"
]);
function openMenu(open) {
  menuOpen = open;
  if (open) clearMovement();
  menu.hidden = !open;
  scrim.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  if (open) document.querySelector("#menu-close").focus();
  else toggle.focus();
}
function showMessage(message, persistent) {
  clearTimeout(dismissTimer);
  story.textContent = message;
  dialogue.hidden = false;
  if (!persistent) dismissTimer = setTimeout(() => { dialogue.hidden = true; }, 2600);
}
function draw() {
  if (!current) return;
  const bounds = game.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = "#193739";
  ctx.fillRect(0, 0, bounds.width, bounds.height);
  const factor = Math.min(bounds.width / MAP_WIDTH, bounds.height / MAP_HEIGHT);
  const offsetX = (bounds.width - MAP_WIDTH * factor) / 2;
  const offsetY = (bounds.height - MAP_HEIGHT * factor) / 2;
  ctx.translate(offsetX, offsetY);
  ctx.scale(factor, factor);
  const rows = current.tiles.map(row => row.replace("@", "."));
  forestFloor();
  paths(rows);
  props(rows);
  drawSprite("hero", current.px / 1000 * TILE, current.py / 1000 * TILE, facing, performance.now() - lastMove < 180);
}
function render(state) {
  if (previousX !== null && state.event === "moved") {
    const dx = state.px - previousX, dy = state.py - previousY;
    if (dx || dy) {
      facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
      stride += 0.75;
      lastMove = performance.now();
    }
  }
  previousX = state.px;
  previousY = state.py;
  if (state.event === "start") { facing = "down"; stride = 0; lastMove = 0; }
  current = state;
  draw();
  const message = messages[state.event] ?? "";
  if (state.event !== "moved" && message) {
    journal.textContent = message;
  }
  if (state.event === "moved") {
    clearTimeout(dismissTimer);
    dialogue.hidden = true;
  } else if (message) {
    showMessage(message, noteworthy.has(state.event));
  }
}
function displayError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}
async function act(key) {
  if (busy || menuOpen) return;
  busy = true;
  try {
    const response = await fetch("/api/action", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({key})
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    render(await response.json());
    errorBox.hidden = true;
  } catch (error) {
    displayError("接続エラー: " + error.message + "。サーバーを確認してください。");
  } finally {
    busy = false;
  }
}
const movementKeys = {
  ArrowUp:"w", ArrowDown:"s", ArrowLeft:"a", ArrowRight:"d",
  w:"w", W:"w", a:"a", A:"a", s:"s", S:"s", d:"d", D:"d"
};
function movementKey() {
  const x = Number(held.has("d")) - Number(held.has("a"));
  const y = Number(held.has("s")) - Number(held.has("w"));
  if (x === 0 && y === 0) return null;
  if (x === -1 && y === -1) return "h";
  if (x === 1 && y === -1) return "u";
  if (x === -1 && y === 1) return "b";
  if (x === 1 && y === 1) return "n";
  return x === -1 ? "a" : x === 1 ? "d" : y === -1 ? "w" : "s";
}
function clearMovement() { held.clear(); }
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && menuOpen) { event.preventDefault(); openMenu(false); return; }
  if (event.altKey || event.ctrlKey || event.metaKey || menuOpen) return;
  if (event.target instanceof HTMLElement && event.target.closest("button,input")) return;
  const direction = movementKeys[event.key];
  if (direction) {
    event.preventDefault();
    held.add(direction);
    return;
  }
  if (event.repeat) return;
  if (event.key === " " || event.key.toLowerCase() === "e") {
    event.preventDefault(); act("e");
  } else if (event.key.toLowerCase() === "r") {
    event.preventDefault(); restart();
  }
});
document.addEventListener("keyup", event => {
  const direction = movementKeys[event.key];
  if (direction) held.delete(direction);
});
window.addEventListener("blur", clearMovement);
movementTimer = window.setInterval(() => {
  if (!busy && !menuOpen) {
    const key = movementKey();
    if (key) act(key);
  }
}, 48);
function restart() {
  if (menuOpen) openMenu(false);
  if (window.confirm("最初からやり直しますか？ 今の進行は失われます。")) act("r");
}
toggle.addEventListener("click", () => openMenu(!menuOpen));
document.querySelector("#menu-close").addEventListener("click", () => openMenu(false));
scrim.addEventListener("click", () => openMenu(false));
document.querySelector("#dismiss-dialogue").addEventListener("click", () => {dialogue.hidden = true;});
document.querySelector("#restart").addEventListener("click", restart);
document.querySelector("#fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await game.requestFullscreen();
  } catch (error) { displayError("全画面表示: " + error.message); }
});
document.querySelector("#show-controls").addEventListener("change", event => {
  touch.hidden = !event.target.checked;
});
document.querySelectorAll("button[data-key]").forEach(button =>
  button.addEventListener("click", () => act(button.dataset.key)));
document.querySelectorAll('input[name="hero-appearance"]').forEach(input => {
  input.checked = input.value === heroAppearance;
  input.addEventListener("change", () => {
    if (!input.checked) return;
    heroAppearance = input.value === "girl" ? "girl" : "boy";
    try { localStorage.setItem(appearanceKey, heroAppearance); } catch { /* private storage is optional */ }
    ready.hero = false;
    sprites.hero.src = heroAsset();
    draw();
  });
});
for (const name of ["hero","lyuna"]) {
  const slider = document.querySelector("#" + name + "-scale");
  const output = document.querySelector("#" + name + "-scale-value");
  slider.value = String(spriteScale[name]);
  output.textContent = spriteScale[name] + "%";
  slider.addEventListener("input", () => {
    spriteScale[name] = Number(slider.value);
    output.textContent = slider.value + "%";
    try { localStorage.setItem(scaleKey, JSON.stringify(spriteScale)); } catch { /* optional */ }
    draw();
  });
}
window.addEventListener("resize", draw);
// Keep walking frames lively between replies from the local Cerune process.
let lastFrame = -1;
window.setInterval(() => {
  if (current && performance.now() - lastMove < 180) {
    const frame = Math.floor(stride + (performance.now() - lastMove) / 90) % 4;
    if (frame !== lastFrame) { lastFrame = frame; draw(); }
  } else if (lastFrame !== -1) { lastFrame = -1; draw(); }
}, 45);
fetch("/api/state")
  .then(response => { if (!response.ok) throw Error("HTTP " + response.status); return response.json(); })
  .then(render)
  .catch(error => displayError("起動できませんでした: " + error.message));
