"use strict";
// Only presentation and input live here; map/collision/events all come from Cerune.
const canvas = document.querySelector("#map");
const ctx = canvas.getContext("2d");
const story = document.querySelector("#story");
const progress = document.querySelector("#progress");
const TILE = 80;
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
const ground = ["#152633", "#527a52", "#527a52", "#637e57", "#527a52", "#527a52", "#152633"];
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
let busy=false;
function render(state) {
  for (let y=0;y<6;y++)for(let x=0;x<7;x++)tile(x,y,state.tiles[y][x]);
  story.textContent=messages[state.event]??"";
  const map=state.tiles.join("");
  progress.textContent=state.finished?"第1章をクリアしました！ R キーでもう一度。":
    map.includes("L") && !map.includes("*")?"欠片を手に入れた。ビーコンを探そう。":
    "E キーで足元を調べよう。リュナは開始地点で話せるよ。";
}
async function act(key) {
  if(busy)return;
  busy=true;
  try {
    const res=await fetch("/api/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key})});
    if(!res.ok)throw new Error("HTTP "+res.status);
    render(await res.json());
  }catch(e){story.textContent="接続エラー: "+e.message+"\nサーバーを確認してください。";}
  finally{busy=false;}
}
document.addEventListener("keydown",e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
  const mapping={ArrowUp:"w",ArrowDown:"s",ArrowLeft:"a",ArrowRight:"d"," ":"e",e:"e",E:"e",r:"r",R:"r",w:"w",a:"a",s:"s",d:"d",W:"w",A:"a",S:"s",D:"d"};
  const key=mapping[e.key];
  if(key){e.preventDefault();act(key);}
});
document.querySelectorAll("button[data-key]").forEach(b=>b.addEventListener("click",()=>act(b.dataset.key)));
fetch("/api/state").then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();}).then(render).catch(e=>{story.textContent="起動できませんでした: "+e.message;});
