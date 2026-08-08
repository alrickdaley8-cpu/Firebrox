const TILE_TYPES = {
  deepWater:{id:0,name:'Deep Water',color:'#0a3a5a',biome:'Ocean',walk:false},
  water:{id:1,name:'Water',color:'#1a6ea8',biome:'Ocean',walk:false},
  sand:{id:2,name:'Sand',color:'#e8d5a3',biome:'Beach',walk:true},
  grass:{id:3,name:'Grass',color:'#7ac74a',biome:'Plains',walk:true},
  forest:{id:4,name:'Forest',color:'#2d6a2e',biome:'Forest',walk:true},
  mountain:{id:5,name:'Mountain',color:'#8a8f98',biome:'Highland',walk:true},
  snow:{id:6,name:'Snow',color:'#eef4ff',biome:'Tundra',walk:true},
  lava:{id:7,name:'Lava',color:'#ff4d2e',biome:'Wasteland',walk:false},
  burnt:{id:8,name:'Burnt',color:'#3a2b1e',biome:'Wasteland',walk:true},
};

// simple seeded noise
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^=a>>>15,1|a); t^=t+Math.imul(t^=t>>>7,61|t); return ((t^=t>>>14)>>>0)/4294967296; } }
function hash2(x,y,seed){ return Math.abs(Math.sin(x*127.1 + y*311.7 + seed*74.7)*43758.5453)%1 }
function smooth(t){ return t*t*(3-2*t) }
function valueNoise(x,y,seed, rnd){
  const xi=Math.floor(x), yi=Math.floor(y);
  const xf=x-xi, yf=y-yi;
  const u=smooth(xf), v=smooth(yf);
  const a=hash2(xi,yi,seed), b=hash2(xi+1,yi,seed), c=hash2(xi,yi+1,seed), d=hash2(xi+1,yi+1,seed);
  const lerp=(x,y,t)=>x+(y-x)*t;
  return lerp(lerp(a,b,u), lerp(c,d,u), v);
}
function fbm(x,y,seed,oct=4){
  let v=0, amp=1, freq=1, max=0;
  for(let i=0;i<oct;i++){ v+= valueNoise(x*freq, y*freq, seed+i*10)*amp; max+=amp; amp*=0.5; freq*=2; }
  return v/max;
}

export class World{
  constructor(W,H,TILE){
    this.W=W; this.H=H; this.TILE=TILE;
    this.tiles=[]; this.elevation=[]; this.moisture=[];
    this.fireTimer=[]; this.entities=[]; this.houses=[];
    this.seedStr='EDEN';
    this.seed=1;
    this.initArrays();
  }
  initArrays(){
    this.tiles = Array.from({length:this.H},()=>Array(this.W).fill(0));
    this.elevation = Array.from({length:this.H},()=>Array(this.W).fill(0));
    this.moisture = Array.from({length:this.H},()=>Array(this.W).fill(0));
    this.fireTimer = Array.from({length:this.H},()=>Array(this.W).fill(0));
  }
  generate(seedStr){
    this.seedStr=seedStr;
    let h=0; for(let i=0;i<seedStr.length;i++) h=(h*31+seedStr.charCodeAt(i))>>>0;
    this.seed=h||1;
    const rnd=mulberry32(this.seed);
    // elevation + moisture
    for(let y=0;y<this.H;y++) for(let x=0;x<this.W;x++){
      const nx=(x/this.W)*3.5 -0.5, ny=(y/this.H)*3.0 -0.5;
      const e = fbm(nx*1.2, ny*1.2, this.seed, 5) * 1.1 + fbm(nx*4, ny*4, this.seed+99,2)*0.12;
      const m = fbm(nx*1.0+10, ny*1.0+10, this.seed+50,4);
      this.elevation[y][x]=e; this.moisture[y][x]=m;
      let id;
      if(e<0.28) id=0;
      else if(e<0.34) id=1;
      else if(e<0.38) id=2;
      else if(e>0.82) id=6;
      else if(e>0.71) id=5;
      else {
        if(m>0.68 && e>0.42) id=4;
        else id=3;
      }
      this.tiles[y][x]=id;
      this.fireTimer[y][x]=0;
    }
    // rivers / lakes sprinkle lava pockets
    for(let i=0;i<8;i++){
      const cx=Math.floor(rnd()*this.W), cy=Math.floor(rnd()*this.H);
      if(this.tiles[cy][cx]===3 || this.tiles[cy][cx]===4){
        for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
          const x=cx+dx,y=cy+dy; if(x<0||y<0||x>=this.W||y>=this.H) continue;
          if(Math.abs(dx)+Math.abs(dy)<=2 && rnd()<0.5) this.tiles[y][x]=1;
        }
      }
    }
    this.houses=[];
    this.generateHouses();
  }
  generateHouses(){
    // houses near grass clusters
    for(let i=0;i<20;i++){
      const x=Math.floor(Math.random()*this.W), y=Math.floor(Math.random()*this.H);
      if(this.tiles[y][x]===3 && Math.random()<0.08) this.houses.push({x,y,life:1});
    }
  }
  getTile(x,y){
    const id=this.tiles[y]?.[x] ?? 0;
    const t=Object.values(TILE_TYPES).find(v=>v.id===id) || TILE_TYPES.grass;
    return t;
  }
  isWalkable(x,y){
    if(x<0||y<0||x>=this.W||y>=this.H) return false;
    const id=this.tiles[y][x];
    return id!==0 && id!==1 && id!==7;
  }
  setTile(x,y, name){
    if(x<0||y<0||x>=this.W||y>=this.H) return;
    const map={water:1, sand:2, grass:3, forest:4, mountain:5, snow:6, lava:7, burnt:8, deepWater:0};
    const id=map[name] ?? 3;
    this.tiles[y][x]=id;
    if(id===7) this.fireTimer[y][x]=5;
    else if(this.fireTimer[y][x]>0 && id!==3 && id!==4) this.fireTimer[y][x]=0;
  }
  spawn(kind,x,y){
    if(!this.isWalkable(x,y) && kind!=='tree') return;
    const e={
      kind, x:x+0.5, y:y+0.5, tx:x, ty:y,
      age:0, hp:10, hunger:0, state:'wander', timer:0,
      dir:Math.random()*Math.PI*2, speed: kind==='human'? 1.2 : kind==='wolf'? 1.6 : 0.9,
      color: kind==='human'? '#ffd166' : kind==='wolf'? '#8a8f98' : kind==='sheep'? '#eef' : '#ffb703',
      emoji: kind==='human'?'🧍':kind==='wolf'?'🐺':kind==='sheep'?'🐑':'🐔'
    };
    this.entities.push(e);
    if(this.entities.length>400) this.entities.shift();
  }
  strike(x,y){
    // lightning strike
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=this.W||ny>=this.H) continue;
      if(this.tiles[ny][nx]===4 || this.tiles[ny][nx]===3){
        this.ignite(nx,ny,1);
      }
    }
    // kill entity
    this.entities.forEach(e=>{
      if(Math.hypot(e.x - x, e.y - y)<1.5) e.hp-=6;
    });
  }
  ignite(x,y,r=1){
    for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
      const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=this.W||ny>=this.H) continue;
      const id=this.tiles[ny][nx];
      if(id===3 || id===4) this.fireTimer[ny][nx]= 3 + Math.random()*3;
    }
  }
  acidRain(x,y,r){
    for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
      const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=this.W||ny>=this.H) continue;
      if(Math.random()<0.5) this.fireTimer[ny][nx]=0;
      if(this.tiles[ny][nx]===7) this.tiles[ny][nx]=3;
      this.entities.forEach(e=>{
        if(Math.floor(e.x)===nx && Math.floor(e.y)===ny && Math.random()<0.3) e.hp-=2;
      });
    }
  }
  bless(x,y,r){
    for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
      const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=this.W||ny>=this.H) continue;
      if(this.tiles[ny][nx]===8) this.tiles[ny][nx]=3;
      this.fireTimer[ny][nx]=0;
    }
    this.entities.forEach(e=>{
      if(Math.hypot(e.x - x, e.y - y) < r+1) e.hp = Math.min(12, e.hp+6);
    });
  }
  nuke(x,y){
    const rad=7;
    for(let dy=-rad; dy<=rad; dy++) for(let dx=-rad; dx<=rad; dx++){
      const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=this.W||ny>=this.H) continue;
      const d=Math.hypot(dx,dy);
      if(d>rad) continue;
      if(d<2) this.tiles[ny][nx]=7;
      else if(d<4) this.tiles[ny][nx]=8;
      else if(d<6 && Math.random()<0.6) this.fireTimer[ny][nx]=2;
    }
    this.entities = this.entities.filter(e=> Math.hypot(e.x-x,e.y-y) > rad*0.6 || Math.random()<0.2 );
  }
  clearEntities(){ this.entities=[]; this.houses=[]; }

  tick(dt){
    // fire spread
    const newFires=[];
    for(let y=0;y<this.H;y++) for(let x=0;x<this.W;x++){
      if(this.fireTimer[y][x]>0){
        this.fireTimer[y][x]-=dt*1.2;
        if(Math.random()<0.08){
          const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
          const [dx,dy]=dirs[Math.floor(Math.random()*4)];
          const nx=x+dx, ny=y+dy;
          if(nx>=0&&ny>=0&&nx<this.W&&ny<this.H){
            const nid=this.tiles[ny][nx];
            if((nid===3 || nid===4) && this.fireTimer[ny][nx]<=0 && Math.random()<0.35) newFires.push([nx,ny]);
          }
        }
        if(this.fireTimer[y][x]<=0){
          this.fireTimer[y][x]=0;
          if(this.tiles[y][x]===4) this.tiles[y][x]=3;
          else if(this.tiles[y][x]===3 && Math.random()<0.4) this.tiles[y][x]=8;
        }
      }
    }
    newFires.forEach(([x,y])=> this.fireTimer[y][x]=2+Math.random()*2 );

    // entities
    for(let i=this.entities.length-1;i>=0;i--){
      const e=this.entities[i];
      e.age+=dt;
      e.hp -= this.tiles[Math.floor(e.y)]?.[Math.floor(e.x)]===7 ? dt*3 : 0;
      if(this.fireTimer[Math.floor(e.y)]?.[Math.floor(e.x)]>0) e.hp -= dt*5;
      e.hunger+=dt*0.2;
      if(e.hp<=0){ this.entities.splice(i,1); continue; }
      // simple AI
      e.timer-=dt;
      if(e.timer<=0){
        e.timer=0.6+Math.random()*1.2;
        if(e.kind==='human'){
          if(e.hunger>3 && Math.random()<0.5){
            // seek forest/sheep
            const target=this.entities.find(a=> (a.kind==='sheep'||a.kind==='chicken') && Math.hypot(a.x-e.x,a.y-e.y)<8);
            if(target){ e.tx=target.x; e.ty=target.y; e.state='hunt';}
            else { e.dir=Math.random()*Math.PI*2; e.state='wander';}
          } else {
            e.dir=Math.random()*Math.PI*2;
            if(Math.random()<0.02 && this.isWalkable(Math.floor(e.x),Math.floor(e.y))) this.houses.push({x:Math.floor(e.x),y:Math.floor(e.y),life:1});
            // reproduction
            if(Math.random()<0.01 && this.entities.filter(x=>x.kind==='human').length<140){
              this.spawn('human', Math.floor(e.x), Math.floor(e.y));
            }
          }
        } else if(e.kind==='wolf'){
          const prey=this.entities.find(a=> a.kind==='human' || a.kind==='sheep');
          if(prey && Math.hypot(prey.x-e.x, prey.y-e.y)<10){ e.tx=prey.x; e.ty=prey.y; e.state='hunt';}
          else e.dir=Math.random()*Math.PI*2;
          if(Math.random()<0.008) this.spawn('wolf', Math.floor(e.x), Math.floor(e.y));
        } else { // sheep/chicken
          e.dir=Math.random()*Math.PI*2;
          if(Math.random()<0.006) this.spawn(e.kind, Math.floor(e.x), Math.floor(e.y));
        }
      }
      let dx, dy;
      if(e.state==='hunt'){ dx=e.tx - e.x; dy=e.ty - e.y; const l=Math.hypot(dx,dy)||1; dx/=l; dy/=l; }
      else { dx=Math.cos(e.dir); dy=Math.sin(e.dir); }
      let nx=e.x + dx*e.speed*dt, ny=e.y + dy*e.speed*dt;
      // avoid water/lava
      const cx=Math.floor(nx), cy=Math.floor(ny);
      if(this.isWalkable(cx,cy) && this.fireTimer[cy]?.[cx]<=0){
        e.x=nx; e.y=ny;
      } else {
        e.dir+= Math.PI*0.6 + (Math.random()-0.5);
      }
      // boundaries
      e.x=Math.max(0.5,Math.min(this.W-0.5,e.x)); e.y=Math.max(0.5,Math.min(this.H-0.5,e.y));
      // collisions eating
      if(e.kind==='human' || e.kind==='wolf'){
        for(let j=this.entities.length-1;j>=0;j--){
          if(i===j) continue;
          const o=this.entities[j];
          if(Math.hypot(o.x-e.x,o.y-e.y)<0.7){
            const prey = (e.kind==='human' && (o.kind==='sheep'||o.kind==='chicken')) || (e.kind==='wolf' && (o.kind==='sheep'||o.kind==='human'||o.kind==='chicken'));
            if(prey){ this.entities.splice(j,1); e.hunger=Math.max(0,e.hunger-4); e.hp=Math.min(12,e.hp+3); if(j<i) i--; }
          }
        }
      }
      if(e.kind==='sheep' && this.tiles[Math.floor(e.y)]?.[Math.floor(e.x)]===4 && Math.random()<0.01){
        this.tiles[Math.floor(e.y)][Math.floor(e.x)]=3;
        e.hunger=Math.max(0,e.hunger-2);
      }
      e.state='wander';
    }
    // houses decay if on fire
    this.houses = this.houses.filter(h=> {
      if(this.fireTimer[h.y]?.[h.x]>0) return Math.random()<0.98 ? false : true;
      return true;
    });
  }

  stats(){
    return {
      humans: this.entities.filter(e=>e.kind==='human').length,
      animals: this.entities.filter(e=>e.kind!=='human').length,
      houses: this.houses.length,
      fires: this.fireTimer.flat().filter(v=>v>0).length
    };
  }

  render(ctx){
    const T=this.TILE;
    for(let y=0;y<this.H;y++) for(let x=0;x<this.W;x++){
      const id=this.tiles[y][x];
      let col=Object.values(TILE_TYPES).find(t=>t.id===id)?.color || '#000';
      // subtle variation
      const v = (Math.sin(x*12.9+y*7.3)*0.5+0.5)*8;
      ctx.fillStyle=col;
      ctx.fillRect(x*T, y*T, T, T);
      if(id===4){
        // tree dots
        ctx.fillStyle='#1a3f1a';
        ctx.fillRect(x*T+2, y*T+2, 2,2);
        ctx.fillRect(x*T+4, y*T+5, 2,1);
      }
      if(id===5){
        ctx.fillStyle='rgba(255,255,255,.35)';
        ctx.fillRect(x*T+2, y*T+1, 4,1);
      }
      if(this.fireTimer[y][x]>0){
        const f=this.fireTimer[y][x];
        ctx.fillStyle = f>1.5 ? `rgba(255,${80+Math.random()*80|0},20,.88)` : `rgba(90,30,10,.55)`;
        ctx.fillRect(x*T, y*T, T, T);
        if(Math.random()<0.3){ ctx.fillStyle='#ffd166'; ctx.fillRect(x*T+3,y*T+2,2,2); }
      }
    }
    // houses
    ctx.fillStyle='#8b5a2b';
    this.houses.forEach(h=>{
      const x=h.x*T, y=h.y*T;
      ctx.fillRect(x+1,y+2, T-2, T-3);
      ctx.fillStyle='#ffd166'; ctx.fillRect(x+3,y+4,2,2); ctx.fillStyle='#8b5a2b';
      ctx.fillStyle='#5a3510'; ctx.fillRect(x+1,y+1, T-2,2);
    });
    // grid subtle
    ctx.strokeStyle='rgba(0,0,0,.06)'; ctx.lineWidth=0.5;
    for(let x=0;x<=this.W;x++){ ctx.beginPath(); ctx.moveTo(x*T,0); ctx.lineTo(x*T,this.H*T); ctx.stroke();}
    for(let y=0;y<=this.H;y++){ ctx.beginPath(); ctx.moveTo(0,y*T); ctx.lineTo(this.W*T,y*T); ctx.stroke();}
  }
  renderEntities(ctx, octx){
    // shadows + entities on main ctx (pixel)
    this.entities.forEach(e=>{
      const x=e.x*this.TILE, y=e.y*this.TILE;
      // shadow
      ctx.fillStyle='rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(x, y+3, 3,1.5,0,0,Math.PI*2); ctx.fill();
      // body
      let col=e.color;
      if(e.kind==='human') col = e.hp<4 ? '#ef476f' : '#ffd166';
      ctx.fillStyle=col;
      ctx.fillRect(Math.floor(x-2), Math.floor(y-3), 4,4);
      // head
      ctx.fillStyle='#ffdcb5';
      ctx.fillRect(Math.floor(x-1), Math.floor(y-4), 2,1);
      // kind accent
      if(e.kind==='wolf'){ ctx.fillStyle='#2b2d42'; ctx.fillRect(Math.floor(x-2),Math.floor(y-2),4,1); }
      if(e.kind==='sheep'){ ctx.fillStyle='#fff'; ctx.fillRect(Math.floor(x-1),Math.floor(y-5),2,2); }
      // hp bar
      if(e.hp<10){
        ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(Math.floor(x-3),Math.floor(y-6),6,1.5);
        ctx.fillStyle='#06d6a0'; ctx.fillRect(Math.floor(x-3),Math.floor(y-6), Math.max(0, e.hp/12*6),1.5);
      }
    });
  }
}
