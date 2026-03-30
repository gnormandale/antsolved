import { useState, useEffect, useRef, useCallback } from "react";

// ── Arena ──
const W = 800, H = 400, WT = 3;

// ── Shapes ──
function makeShape(type) {
  const cw = 19, ch = 6, sw = 7; // half-widths for crossbar 38x12, stem 14
  if (type === "T") {
    const sh = 36;
    return { verts: [
      {x:-cw,y:-ch},{x:cw,y:-ch},{x:cw,y:ch},{x:sw,y:ch},
      {x:sw,y:ch+sh},{x:-sw,y:ch+sh},{x:-sw,y:ch},{x:-cw,y:ch}
    ], label: "T-shape", desc: "38×12 crossbar, 14×36 stem" };
  }
  // Extended T with foot
  const sh = 50, fw = 11, fh = 7; // foot half-width 22, height 7
  return { verts: [
    {x:-cw,y:-ch},{x:cw,y:-ch},{x:cw,y:ch},{x:sw,y:ch},
    {x:sw,y:ch+sh},{x:fw,y:ch+sh},{x:fw,y:ch+sh+fh},
    {x:-fw,y:ch+sh+fh},{x:-fw,y:ch+sh},
    {x:-sw,y:ch+sh},{x:-sw,y:ch},{x:-cw,y:ch}
  ], label: "T + foot", desc: "38×12 crossbar, 14×50 stem, 22×7 foot" };
}

const MIN_GAP = 37, MAX_GAP = 140;

// ── Helpers ──
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = a => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
const rot = (v, a) => ({x:v.x*Math.cos(a)-v.y*Math.sin(a), y:v.x*Math.sin(a)+v.y*Math.cos(a)});
const xv = (verts, cx, cy, a) => verts.map(v => { const r=rot(v,a); return {x:cx+r.x, y:cy+r.y}; });

// ── Dynamic geometry ──
// Gap spacing: wallGap = distance between the two internal walls
// At max (e.g. 600) they're far apart (near original even thirds)
// At min (e.g. 20) they're almost touching — tight double-door
function getWallXs(wallGap) {
  const cx = W / 2; // centre of arena
  return [cx - wallGap / 2, cx + wallGap / 2];
}

function makeWalls(slitW, wallGap) {
  const slitY = (H - slitW) / 2;
  const ws = [[0,0,W,0],[0,H,W,H],[0,0,0,H],[W,0,W,H]];
  for (const x of getWallXs(wallGap)) {
    ws.push([x,0,x,slitY],[x,slitY+slitW,x,H]);
  }
  return ws.map(([x1,y1,x2,y2])=>({x1,y1,x2,y2}));
}

function getSlits(slitW, wallGap) {
  const slitY = (H-slitW)/2;
  return getWallXs(wallGap).map(x => ({x, y: slitY+slitW/2}));
}

function resolveCol(verts, cx, cy, ang, slitW, wallGap) {
  const slitY = (H-slitW)/2;
  const vs = xv(verts,cx,cy,ang);
  const wxs = getWallXs(wallGap);
  let px=0,py=0,hit=false;
  for (const v of vs) {
    if (v.x<WT){px+=WT-v.x;hit=true;}
    if (v.x>W-WT){px+=(W-WT)-v.x;hit=true;}
    if (v.y<WT){py+=WT-v.y;hit=true;}
    if (v.y>H-WT){py+=(H-WT)-v.y;hit=true;}
    for (const wx of wxs) {
      const inS=v.y>slitY+1&&v.y<slitY+slitW-1;
      if (!inS&&Math.abs(v.x-wx)<WT+1){
        px+=(v.x<wx?(wx-WT-1):(wx+WT+1))-v.x;hit=true;
      }
    }
  }
  return {px,py,hit};
}

function isOk(verts, cx, cy, a, slitW, wallGap) {
  const slitY=(H-slitW)/2;
  const wxs = getWallXs(wallGap);
  for (const v of xv(verts,cx,cy,a)) {
    if(v.x<.5||v.x>W-.5||v.y<.5||v.y>H-.5)return false;
    for (const wx of wxs) {
      if(!(v.y>slitY+2&&v.y<slitY+slitW-2)&&Math.abs(v.x-wx)<WT+.5)return false;
    }
  }
  return true;
}

function getCh(x, wallGap) {
  const wxs = getWallXs(wallGap);
  if (x < wxs[0]) return 0;
  if (x < wxs[1]) return 1;
  return 2;
}

function nearSlit(lx, ly, dir, slitW, wallGap) {
  const slits=getSlits(slitW,wallGap);
  let best=slits[0],bestD=Infinity;
  for (const s of slits) {
    const dx=s.x-lx;
    if((dir>0&&dx>-25)||(dir<0&&dx<25)||Math.abs(dx)<45){
      const d=Math.hypot(dx,s.y-ly);
      if(d<bestD){bestD=d;best=s;}
    }
  }
  return best;
}

// ── Populations ──
const POP = {
  slider: { color:"#22d3ee",aC:"#06b6d4",persist:.965,wander:.02,fScale:.32,detach:.0003,wallSlide:true,gapSeek:true,saHeat:.0018,saCool:.93 },
  pusher: { color:"#fb923c",aC:"#f97316",persist:.94,wander:.045,fScale:.42,detach:.0006,wallSlide:false,gapSeek:false,saHeat:.0004,saCool:.99 },
};

function mkAgent(x,y,pop,randFactor) {
  const p=POP[pop];
  return { x,y,pop,heading:Math.random()*Math.PI*2,attached:false,offA:0,offD:0,
    persist:p.persist,wander:p.wander*randFactor,fScale:p.fScale,detach:p.detach,
    wallSlide:p.wallSlide,gapSeek:p.gapSeek,saHeat:p.saHeat,saCool:p.saCool,temp:.05 };
}

function spawnAll(nS,nP,lx,ly,randFactor) {
  const out=[],tot=nS+nP;
  for(let i=0;i<tot;i++){
    const a=(i/tot)*Math.PI*2,r=40+Math.random()*30;
    out.push(mkAgent(lx+Math.cos(a)*r,ly+Math.sin(a)*r,i<nS?"slider":"pusher",randFactor));
  }
  return out;
}

// ═══════════════════════ COMPONENT ═══════════════════════
export default function AntSim() {
  const cvs=useRef(null),sim=useRef(null),raf=useRef(null);
  const [running,setRunning]=useState(false);
  const [solved,setSolved]=useState(false);
  const [stats,setStats]=useState({steps:0,ch:1,sl:0,pu:0,tS:"0.05",tP:"0.05",dir:"\u2192"});
  const [speed,setSpeed]=useState(3);

  // Populations
  const [nSliders,setNSliders]=useState(65);
  const [nPushers,setNPushers]=useState(55);

  // Parameters
  const [retreatFloor,setRetreatFloor]=useState(0.75);
  const [nestBias,setNestBias]=useState(0.65);
  const [gapWidth,setGapWidth]=useState(64);
  const [wallGap,setWallGap]=useState(260);
  const [shape,setShape]=useState("T");
  const [randFactor,setRandFactor]=useState(1.0);

  const P=useRef({retreatFloor:.75,nestBias:.65,gapWidth:64,wallGap:260,randFactor:1.0});
  const shapeRef=useRef(makeShape("T"));
  useEffect(()=>{P.current={retreatFloor,nestBias,gapWidth,wallGap,randFactor};},[retreatFloor,nestBias,gapWidth,wallGap,randFactor]);
  useEffect(()=>{shapeRef.current=makeShape(shape);},[shape]);

  const init=useCallback(()=>{
    const wxs=getWallXs(P.current.wallGap);
    const firstChamberW = wxs[0]; // first wall x = width of first chamber
    const lx=clamp(firstChamberW*0.4, 40, firstChamberW - 30), ly=H/2;
    sim.current={
      load:{x:lx,y:ly,a:0,vx:0,vy:0,va:0},
      agents:spawnAll(nSliders,nPushers,lx,ly,P.current.randFactor),
      trail:[{x:lx,y:ly}],steps:0,solved:false,
      stuckTimer:0,lastPX:lx,lastPY:ly,
      travelDir:1,wallSliding:false,seekGap:false,gapTgt:null,revCount:0,
    };
    setSolved(false);
    setStats({steps:0,ch:1,sl:nSliders,pu:nPushers,tS:"0.05",tP:"0.05",dir:"\u2192"});
  },[nSliders,nPushers,shape]);

  useEffect(()=>{init();setTimeout(draw,30);},[init]);

  // Reset on geometry changes
  const resetGeo=useCallback((fn)=>{fn();setRunning(false);setTimeout(()=>{init();setTimeout(draw,40);},20);},[init]);

  // ── Tick ──
  const tick=useCallback(()=>{
    const s=sim.current; if(!s||s.solved)return;
    const {load,agents}=s, n=agents.length, dt=.016;
    const pp=P.current, verts=shapeRef.current.verts;
    const slitW=pp.gapWidth, go=pp.wallGap;

    const prog=Math.hypot(load.x-s.lastPX,load.y-s.lastPY);
    if(prog>8){s.lastPX=load.x;s.lastPY=load.y;s.stuckTimer=0;}else s.stuckTimer++;

    const away=s.travelDir<0;
    const floor=away?pp.retreatFloor:0.02;
    for(const ag of agents){
      if(prog>8)ag.temp=Math.max(floor,ag.temp*ag.saCool);
      else ag.temp=Math.min(3.0,ag.temp+ag.saHeat);
      if(away&&ag.temp<floor)ag.temp=floor;
    }

    const avgT=agents.reduce((s,a)=>s+a.temp,0)/n;
    if(s.stuckTimer>120&&avgT>0.5){
      if(Math.random()<.012*avgT){
        s.travelDir*=-1;s.revCount++;s.stuckTimer=Math.floor(s.stuckTimer*.25);s.seekGap=false;
        for(const ag of agents)if(ag.attached)ag.heading+=(Math.random()-.5)*ag.temp*.7;
      }
      if(Math.random()<.02*avgT)load.va+=(Math.random()-.5)*.018*avgT;
    }

    const wxs=getWallXs(go);
    const nearW=wxs.find(wx=>Math.abs(load.x-wx)<38);
    if(nearW!==undefined&&!s.seekGap){s.seekGap=true;s.gapTgt=nearSlit(load.x,load.y,s.travelDir,slitW,go);}
    if(s.seekGap&&nearW===undefined)s.seekGap=false;

    const nestA=0,rawG=s.travelDir>0?0:Math.PI;
    const baseG=rawG+norm(nestA-rawG)*pp.nestBias*(s.travelDir<0?1:0);
    const slitG=s.seekGap&&s.gapTgt?Math.atan2(s.gapTgt.y-load.y,s.gapTgt.x-load.x):baseG;
    const wSlitG=s.wallSliding?Math.atan2(nearSlit(load.x,load.y,s.travelDir,slitW,go).y-load.y,nearSlit(load.x,load.y,s.travelDir,slitW,go).x-load.x):baseG;

    let fx=0,fy=0,torque=0;
    const vs=xv(verts,load.x,load.y,load.a);

    for(const ag of agents){
      if(!ag.attached){
        const tl=Math.atan2(load.y-ag.y,load.x-ag.x);
        ag.heading=norm(ag.heading+norm(tl-ag.heading)*.13);
        ag.x+=Math.cos(ag.heading)*2;ag.y+=Math.sin(ag.heading)*2;
        ag.x=clamp(ag.x,4,W-4);ag.y=clamp(ag.y,4,H-4);
        let minD=Infinity;
        for(let i=0;i<vs.length;i++){
          const j=(i+1)%vs.length,ex=vs[j].x-vs[i].x,ey=vs[j].y-vs[i].y,l2=ex*ex+ey*ey;
          const t=l2===0?0:clamp(((ag.x-vs[i].x)*ex+(ag.y-vs[i].y)*ey)/l2,0,1);
          const d=Math.hypot(ag.x-(vs[i].x+t*ex),ag.y-(vs[i].y+t*ey));
          if(d<minD)minD=d;
        }
        if(minD<11){ag.attached=true;const dx=ag.x-load.x,dy=ag.y-load.y;ag.offA=Math.atan2(dy,dx)-load.a;ag.offD=Math.hypot(dx,dy);}
        continue;
      }
      const wa=load.a+ag.offA;ag.x=load.x+Math.cos(wa)*ag.offD;ag.y=load.y+Math.sin(wa)*ag.offD;
      let goal=ag.wallSlide&&s.wallSliding?wSlitG:ag.gapSeek&&s.seekGap?slitG:baseG;
      const noise=ag.wander+ag.temp*.018;
      ag.heading=norm(ag.heading*ag.persist+goal*(1-ag.persist)+(Math.random()-.5)*noise);
      if(Math.random()<ag.detach*(1+ag.temp*.4)){ag.attached=false;continue;}
      const f=ag.fScale*.85,ffx=Math.cos(ag.heading)*f,ffy=Math.sin(ag.heading)*f;
      fx+=ffx;fy+=ffy;torque+=(ag.x-load.x)*ffy-(ag.y-load.y)*ffx;
    }

    const mass=7+n*.18,inertia=mass*600;
    load.vx=(load.vx+fx/mass*dt)*.91;load.vy=(load.vy+fy/mass*dt)*.91;load.va=(load.va+torque/inertia*dt)*.87;
    let nx=load.x+load.vx,ny=load.y+load.vy,na=load.a+load.va;
    s.wallSliding=false;
    for(let i=0;i<5;i++){
      const c=resolveCol(verts,nx,ny,na,slitW,go);
      if(!c.hit)break;nx+=c.px*.35;ny+=c.py*.35;s.wallSliding=true;
      if(c.px!==0)load.vx*=.22;if(c.py!==0)load.vy*=.22;
    }
    if(isOk(verts,nx,ny,na,slitW,go)){load.x=nx;load.y=ny;load.a=na;}
    else{load.vx*=-.15;load.vy*=-.15;load.va*=-.04;s.wallSliding=true;}

    s.steps++;
    if(s.steps%4===0){s.trail.push({x:load.x,y:load.y});if(s.trail.length>4000)s.trail.shift();}
    const lastWx=wxs[wxs.length-1];
    if(load.x>lastWx+28){s.solved=true;setSolved(true);}

    if(s.steps%12===0){
      const sl=agents.filter(a=>a.pop==="slider"),pu=agents.filter(a=>a.pop==="pusher");
      const aTS=sl.length?sl.reduce((s,a)=>s+a.temp,0)/sl.length:0;
      const aTP=pu.length?pu.reduce((s,a)=>s+a.temp,0)/pu.length:0;
      setStats({steps:s.steps,ch:getCh(load.x,go)+1,sl:sl.length,pu:pu.length,
        tS:aTS.toFixed(2),tP:aTP.toFixed(2),dir:s.travelDir>0?"\u2192":"\u2190"});
    }
  },[]);

  // ── Draw ──
  const draw=useCallback(()=>{
    const c=cvs.current;if(!c)return;const ctx=c.getContext("2d");
    const s=sim.current;if(!s)return;
    const pp=P.current,verts=shapeRef.current.verts;
    const slitW=pp.gapWidth,go=pp.wallGap,slitY=(H-slitW)/2;
    const walls=makeWalls(slitW,go),wxs=getWallXs(go);
    const dpr=window.devicePixelRatio||1;
    c.width=W*dpr;c.height=H*dpr;ctx.scale(dpr,dpr);

    ctx.fillStyle="#060910";ctx.fillRect(0,0,W,H);
    // Chamber fills
    const xs=[0,...wxs,W];
    for(let i=0;i<xs.length-1;i++){
      ctx.fillStyle=["#0a0f19","#0c1220","#0e1526"][i]||"#0e1526";
      ctx.fillRect(xs[i]+2,2,xs[i+1]-xs[i]-4,H-4);
    }
    ctx.fillStyle="rgba(34,197,94,0.035)";
    ctx.fillRect(xs[xs.length-2]+2,2,xs[xs.length-1]-xs[xs.length-2]-4,H-4);

    for(const wx of wxs){ctx.fillStyle="rgba(59,130,246,0.08)";ctx.fillRect(wx-5,slitY,10,slitW);}

    if(s.trail.length>1){ctx.lineWidth=1.1;ctx.lineCap="round";
      for(let i=1;i<s.trail.length;i++){
        ctx.strokeStyle=s.trail[i].x>=s.trail[i-1].x?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)";
        ctx.beginPath();ctx.moveTo(s.trail[i-1].x,s.trail[i-1].y);ctx.lineTo(s.trail[i].x,s.trail[i].y);ctx.stroke();
    }}

    ctx.strokeStyle="#2563eb";ctx.lineWidth=WT*1.6;ctx.lineCap="round";
    for(const w of walls){ctx.beginPath();ctx.moveTo(w.x1,w.y1);ctx.lineTo(w.x2,w.y2);ctx.stroke();}

    ctx.font="bold 10px monospace";ctx.textAlign="center";
    ctx.fillStyle="rgba(34,197,94,0.22)";ctx.fillText("NEST \u2192",W-48,H/2+4);

    const vs=xv(verts,s.load.x,s.load.y,s.load.a);
    ctx.beginPath();ctx.moveTo(vs[0].x,vs[0].y);
    for(let i=1;i<vs.length;i++)ctx.lineTo(vs[i].x,vs[i].y);ctx.closePath();
    const tc=s.solved?"#22c55e":s.travelDir>0?"#ef4444":"#f59e0b";
    const g=ctx.createLinearGradient(s.load.x-28,s.load.y-22,s.load.x+28,s.load.y+22);
    g.addColorStop(0,tc);g.addColorStop(1,tc+"aa");ctx.fillStyle=g;ctx.fill();
    ctx.strokeStyle=tc+"66";ctx.lineWidth=1.2;ctx.stroke();

    const aa=s.travelDir>0?0:Math.PI,ax=s.load.x+Math.cos(aa)*16,ay=s.load.y+Math.sin(aa)*16;
    ctx.beginPath();ctx.moveTo(s.load.x,s.load.y);ctx.lineTo(ax,ay);ctx.strokeStyle="#fffc";ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax-Math.cos(aa-.5)*5,ay-Math.sin(aa-.5)*5);ctx.lineTo(ax-Math.cos(aa+.5)*5,ay-Math.sin(aa+.5)*5);ctx.closePath();ctx.fillStyle="#fffc";ctx.fill();
    ctx.beginPath();ctx.arc(s.load.x,s.load.y,2,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();

    for(const ag of s.agents){
      const p=POP[ag.pop],tg=Math.min(1,ag.temp/2);
      ctx.beginPath();ctx.arc(ag.x,ag.y,2.5,0,Math.PI*2);
      if(ag.attached){ctx.fillStyle=p.aC;
        if(ag.temp>.6){ctx.save();ctx.strokeStyle=ag.pop==="slider"?`rgba(34,211,238,${tg*.4})`:`rgba(249,115,22,${tg*.4})`;ctx.lineWidth=2;ctx.stroke();ctx.restore();}
      }else ctx.fillStyle=p.color+"40";
      ctx.fill();
      if(ag.attached){ctx.beginPath();ctx.moveTo(ag.x,ag.y);ctx.lineTo(ag.x+Math.cos(ag.heading)*4,ag.y+Math.sin(ag.heading)*4);ctx.strokeStyle=p.color+"44";ctx.lineWidth=.6;ctx.stroke();}
    }

    let hy=16;ctx.textAlign="left";ctx.font="bold 9px monospace";
    if(s.wallSliding){ctx.fillStyle="rgba(34,211,238,0.6)";ctx.fillText("\u25CF WALL-SLIDE",8,hy);hy+=12;}
    if(s.seekGap){ctx.fillStyle="rgba(34,197,94,0.5)";ctx.fillText("\u25CF GAP-SEEK",8,hy);hy+=12;}
    const sl2=s.agents.filter(a=>a.pop==="slider"),pu2=s.agents.filter(a=>a.pop==="pusher");
    const aTS=sl2.length?sl2.reduce((s,a)=>s+a.temp,0)/sl2.length:0;
    const aTP=pu2.length?pu2.reduce((s,a)=>s+a.temp,0)/pu2.length:0;
    if(aTS>.15){ctx.fillStyle=`rgba(34,211,238,${clamp(aTS/2,.2,.8)})`;ctx.fillText(`\u25CF SLIDER T=${aTS.toFixed(2)}`,8,hy);hy+=12;}
    if(aTP>.15){ctx.fillStyle=`rgba(249,115,22,${clamp(aTP/2,.2,.8)})`;ctx.fillText(`\u25CF PUSHER T=${aTP.toFixed(2)}`,8,hy);}
  },[]);

  useEffect(()=>{
    if(!running){if(raf.current)cancelAnimationFrame(raf.current);return;}
    const loop=()=>{if(!running)return;for(let i=0;i<speed;i++)tick();draw();raf.current=requestAnimationFrame(loop);};
    raf.current=requestAnimationFrame(loop);
    return()=>{if(raf.current)cancelAnimationFrame(raf.current);};
  },[running,tick,draw,speed]);

  const reset=()=>{setRunning(false);init();setTimeout(draw,30);};
  const tC=v=>parseFloat(v)>1.2?"#ef4444":parseFloat(v)>.4?"#f59e0b":"#22c55e";

  const Sl=({label,color,value,min,max,step,onChange,fmt})=>(
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <span style={{fontSize:8.5,color,fontWeight:700,minWidth:72,textAlign:"right"}}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(parseFloat(e.target.value))} style={{width:62,accentColor:color}}/>
      <span style={{fontSize:9.5,color,minWidth:34,fontWeight:600}}>{fmt?fmt(value):value}</span>
    </div>
  );

  const shapeInfo = makeShape(shape);

  return (
    <div style={{minHeight:"100vh",background:"#030509",color:"#cbd5e1",fontFamily:"'JetBrains Mono','Fira Code',monospace",padding:14,display:"flex",flexDirection:"column",alignItems:"center"}}>
      <h1 style={{fontSize:17,fontWeight:900,letterSpacing:".06em",margin:0,background:"linear-gradient(90deg,#06b6d4,#f97316)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
        ANT PIANO-MOVERS — TWO POPULATIONS
      </h1>
      <p style={{fontSize:9,color:"#475569",margin:"2px 0 6px",maxWidth:720,textAlign:"center",lineHeight:1.5}}>
        After Dreyer et al. PNAS 2025 — <span style={{color:"#22d3ee"}}>Sliders</span> +{" "}
        <span style={{color:"#fb923c"}}>Pushers</span> cooperate on a {shapeInfo.label} load. Tuneable geometry, populations, and SA parameters.
      </p>

      {/* Controls */}
      <div style={{display:"flex",gap:6,marginBottom:5,flexWrap:"wrap",justifyContent:"center"}}>
        {/* Shape + Populations */}
        <div style={{padding:"6px 12px",background:"#0a0f18",borderRadius:5,border:"1px solid #151d2b",display:"flex",flexDirection:"column",gap:3}}>
          <div style={{fontSize:7.5,color:"#334155",fontWeight:700,letterSpacing:".12em",textAlign:"center"}}>SHAPE & POPULATIONS</div>
          <div style={{display:"flex",gap:4,justifyContent:"center"}}>
            {["T","T+foot"].map(s=>(
              <button key={s} onClick={()=>{setShape(s==="T"?"T":"T+foot");setRunning(false);}} style={{
                padding:"4px 10px",fontSize:10,fontWeight:700,fontFamily:"inherit",borderRadius:4,cursor:"pointer",
                border:shape===(s==="T"?"T":"T+foot")?`2px solid #a78bfa`:"2px solid #1e293b",
                background:shape===(s==="T"?"T":"T+foot")?"#a78bfa15":"#0c1017",
                color:shape===(s==="T"?"T":"T+foot")?"#a78bfa":"#4b5563",
              }}>{s}</button>
            ))}
          </div>
          <Sl label="SLIDERS" color="#22d3ee" value={nSliders} min={5} max={120} step={1}
            onChange={v=>{setNSliders(v);setRunning(false);}}/>
          <Sl label="PUSHERS" color="#fb923c" value={nPushers} min={5} max={120} step={1}
            onChange={v=>{setNPushers(v);setRunning(false);}}/>
          <div style={{fontSize:9,color:"#64748b",fontWeight:700,textAlign:"center"}}>TOTAL: {nSliders+nPushers}</div>
        </div>

        {/* Geometry */}
        <div style={{padding:"6px 12px",background:"#0a0f18",borderRadius:5,border:"1px solid #151d2b",display:"flex",flexDirection:"column",gap:3}}>
          <div style={{fontSize:7.5,color:"#334155",fontWeight:700,letterSpacing:".12em",textAlign:"center"}}>GEOMETRY</div>
          <Sl label="GAP WIDTH" color="#3b82f6" value={gapWidth} min={MIN_GAP} max={MAX_GAP} step={1}
            onChange={v=>resetGeo(()=>setGapWidth(v))} fmt={v=>v+"px"}/>
          <div style={{fontSize:7.5,color:"#334155",textAlign:"center",marginTop:-2}}>min {MIN_GAP}px = rotation limit</div>
          <Sl label="GAP SPACING" color="#8b5cf6" value={wallGap} min={10} max={650} step={5}
            onChange={v=>resetGeo(()=>setWallGap(v))} fmt={v=>v+"px"}/>
          <div style={{fontSize:7.5,color:"#334155",textAlign:"center",marginTop:-2}}>distance between walls (10 = nearly touching, ~260 = even)</div>
        </div>

        {/* SA params */}
        <div style={{padding:"6px 12px",background:"#0a0f18",borderRadius:5,border:"1px solid #151d2b",display:"flex",flexDirection:"column",gap:3}}>
          <div style={{fontSize:7.5,color:"#334155",fontWeight:700,letterSpacing:".12em",textAlign:"center"}}>BEHAVIOUR</div>
          <Sl label="TEMP FLOOR" color="#ef4444" value={retreatFloor} min={0.1} max={2.5} step={0.05}
            onChange={setRetreatFloor} fmt={v=>v.toFixed(2)}/>
          <Sl label="NEST BIAS" color="#22c55e" value={nestBias} min={0} max={1} step={0.05}
            onChange={setNestBias} fmt={v=>(v*100).toFixed(0)+"%"}/>
          <Sl label="RANDOMNESS" color="#e879f9" value={randFactor} min={0.2} max={4.0} step={0.1}
            onChange={v=>{setRandFactor(v);setRunning(false);}} fmt={v=>v.toFixed(1)+"\u00d7"}/>
        </div>
      </div>

      {/* Canvas */}
      <div style={{position:"relative",border:"2px solid #1a2030",borderRadius:6,overflow:"hidden"}}>
        <canvas ref={cvs} style={{width:W,height:H,display:"block"}}/>
        {solved&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)",backdropFilter:"blur(3px)"}}>
            <div style={{padding:"16px 36px",background:"rgba(34,197,94,.12)",border:"2px solid #22c55e",borderRadius:8,textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:900,color:"#22c55e"}}>SOLVED</div>
              <div style={{fontSize:11,color:"#86efac",marginTop:3}}>{stats.steps.toLocaleString()} steps</div>
            </div>
          </div>
        )}
      </div>

      {/* Transport */}
      <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
        <button onClick={()=>setRunning(!running)} style={{padding:"6px 20px",fontSize:11,fontWeight:700,fontFamily:"inherit",border:"2px solid #2563eb",borderRadius:5,background:running?"#2563eb18":"#2563eb",color:running?"#2563eb":"#fff",cursor:"pointer",minWidth:72}}>{running?"PAUSE":"RUN"}</button>
        <button onClick={reset} style={{padding:"6px 14px",fontSize:11,fontWeight:700,fontFamily:"inherit",border:"2px solid #1e293b",borderRadius:5,background:"#0c1017",color:"#64748b",cursor:"pointer"}}>RESET</button>
        <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:8}}>
          <span style={{fontSize:8,color:"#475569"}}>SPEED</span>
          <input type="range" min={1} max={20} value={speed} onChange={e=>setSpeed(+e.target.value)} style={{width:70,accentColor:"#2563eb"}}/>
          <span style={{fontSize:9,color:"#64748b",minWidth:22}}>{speed}\u00d7</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:11,marginTop:7,padding:"6px 14px",background:"#0a0f18",borderRadius:5,border:"1px solid #151d2b",flexWrap:"wrap",justifyContent:"center"}}>
        {[
          {l:"SLIDERS",v:stats.sl,c:"#22d3ee"},{l:"S-TEMP",v:stats.tS,c:tC(stats.tS)},
          {l:"PUSHERS",v:stats.pu,c:"#fb923c"},{l:"P-TEMP",v:stats.tP,c:tC(stats.tP)},
          {l:"CH",v:`${stats.ch}/3`,c:"#2563eb"},{l:"DIR",v:stats.dir,c:stats.dir==="\u2192"?"#22c55e":"#f59e0b"},
          {l:"STEPS",v:typeof stats.steps==="number"?stats.steps.toLocaleString():stats.steps,c:"#64748b"},
        ].map(s=>(
          <div key={s.l} style={{textAlign:"center",minWidth:38}}>
            <div style={{fontSize:7,color:"#334155",fontWeight:700,letterSpacing:".1em"}}>{s.l}</div>
            <div style={{fontSize:12,fontWeight:800,color:s.c,marginTop:1}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{maxWidth:760,marginTop:10,padding:"10px 14px",background:"#080c13",borderRadius:6,border:"1px solid #151d2b",fontSize:9.5,lineHeight:1.6,color:"#7c8ba0"}}>
        <div style={{fontWeight:800,color:"#cbd5e1",marginBottom:4,fontSize:10}}>PARAMETERS</div>
        <p style={{margin:"0 0 4px"}}><span style={{color:"#a78bfa",fontWeight:700}}>Shape</span> — T-shape (simple) or T+foot (longer stem with horizontal foot at base, harder to manoeuvre). Both share the same minimum gap of {MIN_GAP}px (crossbar-dominated), but the foot creates more jamming and requires greater rotation control.</p>
        <p style={{margin:"0 0 4px"}}><span style={{color:"#8b5cf6",fontWeight:700}}>Gap Spacing</span> — Distance in px between the two internal walls. At ~260px the three chambers are roughly equal. Drag down toward 10px to push the walls nearly touching — the T must pass through both slits in quick succession with barely any room to reorient between them. Go higher to spread the walls apart for easier navigation.</p>
        <p style={{margin:"0 0 4px"}}><span style={{color:"#e879f9",fontWeight:700}}>Randomness</span> — Multiplier on agent heading noise. At 0.2× agents are nearly deterministic; at 4.0× they're chaotic. Affects both populations proportionally.</p>
        <p style={{margin:"0 0 4px"}}><span style={{color:"#ef4444",fontWeight:700}}>Temp Floor</span> — Min temperature when retreating. Now scales up to 2.5 for extreme restlessness during retreat.</p>
        <p style={{margin:0}}><span style={{color:"#22d3ee",fontWeight:700}}>Populations</span> — Up to 120 of each type (240 total). More ants = more force but also more coordination overhead.</p>
      </div>
    </div>
  );
}
