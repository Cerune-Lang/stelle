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
function tile(x, y, c) {
  const X = x*TILE, Y = y*TILE;
  ctx.fillStyle = c === "#" ? "#293e3d" : c === "~" ? "#357f9e" : "#6c9168";
  ctx.fillRect(X,Y,TILE,TILE);
  ctx.strokeStyle = "#ffffff12";
  ctx.strokeRect(X+.5,Y+.5,TILE-1,TILE-1);
  if (c==="#") {
    ctx.fillStyle="#314e49"; ctx.fillRect(X+13,Y+17,54,53);
    ctx.fillStyle="#57816a"; ctx.beginPath();ctx.arc(X+40,Y+24,29,0,Math.PI*2);ctx.fill();
  } else if(c==="~") {
    ctx.fillStyle="#8cc7d1";ctx.fillRect(X+10,Y+23,36,3);ctx.fillRect(X+32,Y+52,39,3);
  } else if(c==="=") {
    ctx.fillStyle="#4e91a7";ctx.fillRect(X,Y,TILE,TILE);
    ctx.fillStyle="#a77e4e";for(let i=0;i<4;i++)ctx.fillRect(X+i*20+1,Y+9,16,62);
  } else if(c==="B"||c==="+"){
    ctx.fillStyle="#986d3a";ctx.fillRect(X+35,Y+18,12,48);
    ctx.fillStyle=c==="+"?"#ffdf8b":"#829eab";
    ctx.beginPath();ctx.arc(X+41,Y+20,12,0,Math.PI*2);ctx.fill();
  } else if(c==="H"){
    ctx.fillStyle="#d2b382";ctx.fillRect(X+13,Y+25,55,45);
    ctx.fillStyle="#995649";ctx.beginPath();ctx.moveTo(X+7,Y+28);ctx.lineTo(X+40,Y+2);ctx.lineTo(X+74,Y+28);ctx.fill();
    ctx.fillStyle="#5a3d31";ctx.fillRect(X+34,Y+43,14,27);
  } else if(c==="L"){
    ctx.fillStyle="#ffdb91";ctx.beginPath();ctx.arc(X+40,Y+26,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#945c91";ctx.fillRect(X+27,Y+39,27,25);
  } else if(c==="*"){
    ctx.fillStyle="#f8e3a2";ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,r=i%2?10:22;const px=X+40+Math.cos(a)*r,py=Y+39+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill();
  } else if(c==="@"){
    ctx.fillStyle="#f1ce96";ctx.beginPath();ctx.arc(X+40,Y+25,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#365b92";ctx.fillRect(X+27,Y+38,26,29);
    ctx.fillStyle="#f9ebd0";ctx.fillRect(X+25,Y+66,10,8);ctx.fillRect(X+45,Y+66,10,8);
  } else {
    ctx.fillStyle="#92b27d";ctx.fillRect(X+19,Y+15,3,9);ctx.fillRect(X+60,Y+52,3,10);
  }
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
  ctx.fillStyle = "#213d41";
  ctx.fillRect(0, 0, bounds.width, bounds.height);
  // Always show the complete Cerune map, scaled as large as possible.
  const factor = Math.min(bounds.width / MAP_WIDTH, bounds.height / MAP_HEIGHT);
  const offsetX = (bounds.width - MAP_WIDTH * factor) / 2;
  const offsetY = (bounds.height - MAP_HEIGHT * factor) / 2;
  ctx.translate(offsetX, offsetY);
  ctx.scale(factor, factor);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
    const symbol = current.tiles[y][x];
    tile(x, y, symbol === "@" ? "." : symbol);
  }
  // Cerune supplies the continuous position; drawing never decides collision.
  ctx.save();
  ctx.translate((current.px / 1000 - 0.5) * TILE, (current.py / 1000 - 0.5) * TILE);
  tile(0, 0, "@");
  ctx.restore();
}
function render(state) {
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
window.addEventListener("resize", draw);
fetch("/api/state")
  .then(response => { if (!response.ok) throw Error("HTTP " + response.status); return response.json(); })
  .then(render)
  .catch(error => displayError("起動できませんでした: " + error.message));
