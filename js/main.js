import { World } from './world.js';

const canvas = document.getElementById('world');
const overlay = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const octx = overlay.getContext('2d');

const TILE = 8; // pixel size per cell
let W = 120, H = 80; // grid size
const world = new World(W, H, TILE);

let tool = 'inspect';
let brush = 1;
let intensity = 2;
let paused = false;
let speed = 2;
let zoom = 1;
let pan = {x:0,y:0};
let isDragging=false, isPanning=false, lastMouse={x:0,y:0};
let hoverCell = null;
let year = 0;

const tooltip = document.getElementById('tooltip');

function resizeCanvas(){
  const vp = document.getElementById('viewport');
  const availW = vp.clientWidth - 32;
  const availH = vp.clientHeight - 48;
  const scale = Math.min(availW / (W*TILE), availH / (H*TILE), 1.6);
  zoom = Math.max(0.5, Math.min(scale, 2.5));
  updateTransform();
  document.getElementById('zoom-label').textContent = Math.round(zoom*100)+'%';
}
function updateTransform(){
  const s = zoom;
  const t = `translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${s})`;
  canvas.style.transform = t;
  overlay.style.transform = t;
  overlay.style.width = canvas.style.width;
}

// UI bindings
document.querySelectorAll('.tool').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.tool').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    tool=b.dataset.tool;
  });
});
document.querySelectorAll('.bs').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.bs').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    brush=parseInt(b.dataset.brush);
  });
});
document.getElementById('intensity').addEventListener('input', e=> intensity=parseInt(e.target.value));
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.querySelectorAll('.speed').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.speed').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); speed=parseInt(b.dataset.speed);
}));
document.getElementById('btn-new').addEventListener('click',()=> newWorld());
document.getElementById('btn-generate').addEventListener('click',()=>{
  const v=document.getElementById('seed-input').value || Math.random().toString(36).slice(2,8);
  newWorld(v);
});
document.getElementById('zoom-in').addEventListener('click',()=>{zoom=Math.min(3,zoom+0.15);updateTransform();document.getElementById('zoom-label').textContent=Math.round(zoom*100)+'%'});
document.getElementById('zoom-out').addEventListener('click',()=>{zoom=Math.max(0.4,zoom-0.15);updateTransform();document.getElementById('zoom-label').textContent=Math.round(zoom*100)+'%'});

function togglePause(){
  paused=!paused;
  const b=document.getElementById('btn-pause');
  b.textContent = paused ? '▶️ PLAY' : '⏸️ PAUSE';
  b.classList.toggle('active', !paused);
  log(paused?'World paused':'Time resumes', 'life');
}

function screenToCell(e){
  const rect = canvas.getBoundingClientRect();
  // rect already includes transform scale/pan via CSS transform, so we compute inverse
  // Simpler: map via canvas internal size vs rect size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const cx = Math.floor(x / TILE);
  const cy = Math.floor(y / TILE);
  return {cx, cy, x, y};
}

function applyTool(cx, cy){
  const r = Math.floor(brush/2);
  for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
    if(Math.abs(dx)+Math.abs(dy) > r + 1) continue;
    const x=cx+dx, y=cy+dy;
    if(x<0||y<0||x>=W||y>=H) continue;
    switch(tool){
      case 'land': world.setTile(x,y,'grass'); break;
      case 'water': world.setTile(x,y,'water'); break;
      case 'sand': world.setTile(x,y,'sand'); break;
      case 'forest': world.setTile(x,y,'forest'); break;
      case 'mountain': world.setTile(x,y,'mountain'); break;
      case 'lava': world.setTile(x,y,'lava'); break;
      case 'human': if(Math.random()<0.3) world.spawn('human',x,y); break;
      case 'sheep': if(Math.random()<0.3) world.spawn('sheep',x,y); break;
      case 'wolf': if(Math.random()<0.3) world.spawn('wolf',x,y); break;
      case 'chicken': if(Math.random()<0.3) world.spawn('chicken',x,y); break;
      case 'tree': world.setTile(x,y,'forest'); break;
      case 'lightning': world.strike(x,y); break;
      case 'fire': world.ignite(x,y, r); break;
      case 'rain': world.acidRain(x,y,r); break;
      case 'nuke': if(dx===0&&dy===0) world.nuke(x,y); break;
      case 'heal': world.bless(x,y,r); break;
    }
  }
}

// Canvas events
overlay.style.pointerEvents='auto';
overlay.addEventListener('pointerdown', e=>{
  overlay.setPointerCapture(e.pointerId);
  if(e.button===2 || (tool==='hand' )){
    isPanning=true; lastMouse={x:e.clientX,y:e.clientY}; return;
  }
  isDragging=true;
  const {cx,cy}=screenToCell(e);
  if(tool!=='inspect' && tool!=='hand') applyTool(cx,cy);
  else if(['lightning','nuke','fire'].includes(tool)) applyTool(cx,cy);
});
overlay.addEventListener('pointermove', e=>{
  const {cx,cy}=screenToCell(e);
  if(cx>=0&&cy>=0&&cx<W&&cy<H){
    hoverCell={x:cx,y:cy};
    const t=world.getTile(cx,cy);
    document.getElementById('tile-info').textContent = `${t.name} • (${cx},${cy}) • Elev ${world.elevation[cy][cx].toFixed(2)}`;
    document.getElementById('kv-tile').textContent=t.name;
    document.getElementById('kv-biome').textContent=t.biome;
    document.getElementById('kv-elev').textContent=world.elevation[cy][cx].toFixed(2);
    document.getElementById('kv-moist').textContent=world.moisture[cy][cx].toFixed(2);
    tooltip.style.display='block';
    tooltip.style.left=(e.clientX - overlay.getBoundingClientRect().left)+'px';
    tooltip.style.top=(e.clientY - overlay.getBoundingClientRect().top)+'px';
    tooltip.textContent=`${t.name} • ${t.biome}`;
  }
  if(isPanning){
    pan.x += e.clientX - lastMouse.x;
    pan.y += e.clientY - lastMouse.y;
    lastMouse={x:e.clientX,y:e.clientY};
    updateTransform();
  } else if(isDragging && tool!=='inspect' && tool!=='hand'){
    const {cx,cy}=screenToCell(e);
    applyTool(cx,cy);
  }
  drawOverlay();
});
overlay.addEventListener('pointerup', ()=>{isDragging=false; isPanning=false;});
overlay.addEventListener('pointerleave', ()=>{tooltip.style.display='none'; hoverCell=null; drawOverlay();});
overlay.addEventListener('contextmenu', e=>e.preventDefault());
overlay.addEventListener('wheel', e=>{
  e.preventDefault();
  const delta = Math.sign(e.deltaY) * -0.08;
  zoom = Math.max(0.4, Math.min(3, zoom + delta));
  updateTransform();
  document.getElementById('zoom-label').textContent=Math.round(zoom*100)+'%';
},{passive:false});

// Keyboard
window.addEventListener('keydown', e=>{
  if(e.code==='Space'){ e.preventDefault(); togglePause(); }
  if(e.key==='r' || e.key==='R') newWorld();
  if(e.key==='c' || e.key==='C'){ world.clearEntities(); log('Cleared life','danger')}
  if(e.key>='1' && e.key<='4'){ speed=parseInt(e.key); document.querySelectorAll('.speed').forEach(b=>b.classList.toggle('active', b.dataset.speed===e.key));}
  if(e.key==='[') {brush=Math.max(1,brush-2); updateBrushUI();}
  if(e.key===']') {brush=Math.min(9,brush+2); updateBrushUI();}
});
function updateBrushUI(){
  document.querySelectorAll('.bs').forEach(b=>b.classList.toggle('active', parseInt(b.dataset.brush)===brush));
}

function log(msg, cls=''){
  const el=document.createElement('div');
  el.className='log-entry '+cls;
  el.textContent=`[${Math.floor(year)}] ${msg}`;
  const box=document.getElementById('log');
  box.prepend(el);
  while(box.children.length>18) box.removeChild(box.lastChild);
}

function newWorld(seed){
  const s = seed || Math.random().toString(36).slice(2,7).toUpperCase();
  document.getElementById('seed-label').textContent=s;
  document.getElementById('seed-input').value=s;
  world.generate(s);
  year=0;
  world.clearEntities();
  // sprinkle initial life
  for(let i=0;i<18;i++){
    const x=Math.floor(Math.random()*W), y=Math.floor(Math.random()*H);
    if(world.isWalkable(x,y)) world.spawn('human',x,y);
  }
  for(let i=0;i<24;i++){
    const x=Math.floor(Math.random()*W), y=Math.floor(Math.random()*H);
    if(world.isWalkable(x,y)) world.spawn(Math.random()<0.5?'sheep':'chicken',x,y);
  }
  for(let i=0;i<6;i++){
    const x=Math.floor(Math.random()*W), y=Math.floor(Math.random()*H);
    if(world.isWalkable(x,y)) world.spawn('wolf',x,y);
  }
  log(`World "${s}" created — let there be life`,'life');
  resizeCanvas();
}

// Graph
const gctx=document.getElementById('graph').getContext('2d');
const histHuman=[], histAnimal=[];
function drawGraph(){
  const c=document.getElementById('graph');
  const w=c.width, h=c.height;
  gctx.clearRect(0,0,w,h);
  gctx.fillStyle='#0f1420'; gctx.fillRect(0,0,w,h);
  gctx.strokeStyle='rgba(255,255,255,.06)';
  for(let i=0;i<4;i++){ gctx.beginPath(); gctx.moveTo(0,i*h/4); gctx.lineTo(w,i*h/4); gctx.stroke();}
  const max = Math.max(10, ...histHuman, ...histAnimal);
  const plot = (arr,color)=>{
    gctx.strokeStyle=color; gctx.lineWidth=2; gctx.beginPath();
    arr.forEach((v,i)=>{
      const x=i/(Math.max(1,arr.length-1))*w;
      const y=h - (v/max)*h;
      if(i===0) gctx.moveTo(x,y); else gctx.lineTo(x,y);
    }); gctx.stroke();
  };
  plot(histHuman,'#ffd166'); plot(histAnimal,'#06d6a0');
}

function drawOverlay(){
  octx.clearRect(0,0,overlay.width, overlay.height);
  if(hoverCell && brush>1 && tool!=='inspect' && tool!=='hand'){
    const r=Math.floor(brush/2);
    octx.strokeStyle = ['lava','nuke','fire','lightning'].includes(tool) ? '#ef476f' : '#ffd166';
    octx.lineWidth=1.5; octx.setLineDash([4,4]);
    for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
      if(Math.abs(dx)+Math.abs(dy) > r+1) continue;
      const x=hoverCell.x+dx, y=hoverCell.y+dy;
      if(x<0||y<0||x>=W||y>=H) continue;
      octx.strokeRect(x*TILE+0.5, y*TILE+0.5, TILE-1, TILE-1);
    }
    octx.setLineDash([]);
  }
  // entity selection highlight - handled in world.drawEntities overlay pass? we draw highlight here
  if(hoverCell){
    octx.strokeStyle='rgba(255,255,255,.9)'; octx.lineWidth=1;
    octx.strokeRect(hoverCell.x*TILE+0.5, hoverCell.y*TILE+0.5, TILE, TILE);
  }
}

// Main loop
let last=performance.now(), acc=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000; last=now;
  if(paused) dt=0;
  dt*= speed * 1.2; // game speed
  acc+=dt;
  // fixed tick 12 Hz
  while(acc > 1/12){
    world.tick(1/12);
    year += 1/12 / 8; // year progresses
    acc -= 1/12;
  }
  world.render(ctx);
  world.renderEntities(ctx, octx);
  drawOverlay();
  // stats
  const s=world.stats();
  document.getElementById('stat-pop').textContent=s.humans + s.animals;
  document.getElementById('stat-villages').textContent=s.houses;
  document.getElementById('stat-year').textContent=`Year ${Math.floor(year)}`;
  document.getElementById('kv-humans').textContent=s.humans;
  document.getElementById('kv-animals').textContent=s.animals;
  document.getElementById('kv-houses').textContent=s.houses;
  document.getElementById('kv-fires').textContent=s.fires;
  document.getElementById('bar-temp').style.width = Math.round( 45 + Math.sin(year*0.05)*12 ) + '%';
  // hist
  if(Math.floor(year*2) % 2===0){
    // push every ~0.5 year
  }
  // push 20 fps
  if(Math.random()<0.04){
    histHuman.push(s.humans); if(histHuman.length>60) histHuman.shift();
    histAnimal.push(s.animals); if(histAnimal.length>60) histAnimal.shift();
    drawGraph();
  }
}
newWorld('EDEN-7');
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(frame);

// expose
window.world=world;
