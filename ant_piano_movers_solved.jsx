import { useState, useEffect, useRef, useCallback } from "react";

// ── Arena ──
const W = 780, H = 380;
const CW = W / 3;
const WT = 3;

// ── T-shape (smaller arms) ──
const TC_W = 38, TC_H = 12, TS_W = 14, TS_H = 36;
const T_LOCAL = (() => {
  const cw = TC_W / 2, ch = TC_H / 2, sw = TS_W / 2;
  return [
    { x: -cw, y: -ch }, { x: cw, y: -ch }, { x: cw, y: ch },
    { x: sw, y: ch }, { x: sw, y: ch + TS_H }, { x: -sw, y: ch + TS_H },
    { x: -sw, y: ch }, { x: -cw, y: ch },
  ];
})();

// ── Helpers ──
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const rot = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const xv = (cx, cy, a) => T_LOCAL.map(v => { const r = rot(v, a); return { x: cx + r.x, y: cy + r.y }; });

// ── Dynamic walls + slits based on gap width ──
function makeWalls(slitW) {
  const slitY = (H - slitW) / 2;
  const ws = [[0,0,W,0],[0,H,W,H],[0,0,0,H],[W,0,W,H]];
  for (let i = 1; i <= 2; i++) {
    const x = CW * i;
    ws.push([x, 0, x, slitY], [x, slitY + slitW, x, H]);
  }
  return ws.map(([x1,y1,x2,y2]) => ({ x1,y1,x2,y2 }));
}

function getSlits(slitW) {
  const slitY = (H - slitW) / 2;
  return [1, 2].map(i => ({ x: CW * i, y: slitY + slitW / 2 }));
}

function resolveCol(cx, cy, ang, slitW) {
  const slitY = (H - slitW) / 2;
  const vs = xv(cx, cy, ang);
  let px = 0, py = 0, hit = false;
  for (const v of vs) {
    if (v.x < WT) { px += WT - v.x; hit = true; }
    if (v.x > W - WT) { px += (W - WT) - v.x; hit = true; }
    if (v.y < WT) { py += WT - v.y; hit = true; }
    if (v.y > H - WT) { py += (H - WT) - v.y; hit = true; }
    for (let i = 1; i <= 2; i++) {
      const wx = CW * i;
      const inS = v.y > slitY + 1 && v.y < slitY + slitW - 1;
      if (!inS && Math.abs(v.x - wx) < WT + 1) {
        px += (v.x < wx ? (wx - WT - 1) : (wx + WT + 1)) - v.x;
        hit = true;
      }
    }
  }
  return { px, py, hit };
}

function isOk(cx, cy, a, slitW) {
  const slitY = (H - slitW) / 2;
  for (const v of xv(cx, cy, a)) {
    if (v.x < .5 || v.x > W - .5 || v.y < .5 || v.y > H - .5) return false;
    for (let i = 1; i <= 2; i++) {
      const wx = CW * i;
      if (!(v.y > slitY + 2 && v.y < slitY + slitW - 2) && Math.abs(v.x - wx) < WT + .5) return false;
    }
  }
  return true;
}

function getCh(x) { return x < CW ? 0 : x < CW * 2 ? 1 : 2; }

function nearSlit(lx, ly, dir, slitW) {
  const slits = getSlits(slitW);
  let best = slits[0], bestD = Infinity;
  for (const s of slits) {
    const dx = s.x - lx;
    if ((dir > 0 && dx > -25) || (dir < 0 && dx < 25) || Math.abs(dx) < 45) {
      const d = Math.hypot(dx, s.y - ly);
      if (d < bestD) { bestD = d; best = s; }
    }
  }
  return best;
}

// ── Two populations ──
const POP = {
  slider: {
    color: "#22d3ee", attachColor: "#06b6d4",
    persist: 0.965, wander: 0.02, fScale: 0.32, detachRate: 0.0003,
    usesWallSlide: true, usesGapSeek: true,
    saHeatRate: 0.0018, saCoolRate: 0.93,
  },
  pusher: {
    color: "#fb923c", attachColor: "#f97316",
    persist: 0.94, wander: 0.045, fScale: 0.42, detachRate: 0.0006,
    usesWallSlide: false, usesGapSeek: false,
    saHeatRate: 0.0004, saCoolRate: 0.99,
  },
};

function makeAgent(x, y, pop) {
  const p = POP[pop];
  return {
    x, y, pop,
    heading: Math.random() * Math.PI * 2,
    attached: false, offA: 0, offD: 0,
    persist: p.persist, wander: p.wander, fScale: p.fScale,
    detachRate: p.detachRate,
    usesWallSlide: p.usesWallSlide, usesGapSeek: p.usesGapSeek,
    saHeat: p.saHeatRate, saCool: p.saCoolRate,
    temp: 0.05,
  };
}

function spawnAll(nS, nP, lx, ly) {
  const out = [], tot = nS + nP;
  for (let i = 0; i < tot; i++) {
    const a = (i / tot) * Math.PI * 2, r = 40 + Math.random() * 30;
    out.push(makeAgent(lx + Math.cos(a) * r, ly + Math.sin(a) * r, i < nS ? "slider" : "pusher"));
  }
  return out;
}

// ═══════════════════════ COMPONENT ═══════════════════════
export default function AntSim() {
  const cvs = useRef(null);
  const sim = useRef(null);
  const raf = useRef(null);
  const [running, setRunning] = useState(false);
  const [solved, setSolved] = useState(false);
  const [stats, setStats] = useState({
    steps: 0, ch: 1, sliders: 0, pushers: 0,
    avgTempS: "0.05", avgTempP: "0.05", dir: "\u2192",
  });
  const [speed, setSpeed] = useState(3);

  // Population sliders
  const [sliderCount, setSliderCount] = useState(55);
  const [pusherCount, setPusherCount] = useState(45);

  // NEW tuneable parameters
  const [retreatFloor, setRetreatFloor] = useState(0.75);  // temp floor when going wrong way
  const [nestBias, setNestBias] = useState(0.65);           // 0..1: how strongly goal is biased nestward
  const [gapWidth, setGapWidth] = useState(64);             // slit width in px (20..120)

  // Store params in ref so tick/draw always see current values
  const params = useRef({ retreatFloor: 0.75, nestBias: 0.65, gapWidth: 64 });
  useEffect(() => {
    params.current = { retreatFloor, nestBias, gapWidth };
  }, [retreatFloor, nestBias, gapWidth]);

  const init = useCallback(() => {
    const lx = CW * 0.42, ly = H / 2;
    sim.current = {
      load: { x: lx, y: ly, a: 0, vx: 0, vy: 0, va: 0 },
      agents: spawnAll(sliderCount, pusherCount, lx, ly),
      trail: [{ x: lx, y: ly }],
      steps: 0, solved: false,
      stuckTimer: 0, lastPX: lx, lastPY: ly,
      travelDir: 1, wallSliding: false,
      seekGap: false, gapTgt: null, revCount: 0,
    };
    setSolved(false);
    setStats({
      steps: 0, ch: 1, sliders: sliderCount, pushers: pusherCount,
      avgTempS: "0.05", avgTempP: "0.05", dir: "\u2192",
    });
  }, [sliderCount, pusherCount]);

  useEffect(() => { init(); requestAnimationFrame(draw); }, [init]);

  // ── Tick ──
  const tick = useCallback(() => {
    const s = sim.current;
    if (!s || s.solved) return;
    const { load, agents } = s;
    const n = agents.length;
    const dt = 0.016;
    const P = params.current;
    const slitW = P.gapWidth;

    // ── Global stuck detection ──
    const prog = Math.hypot(load.x - s.lastPX, load.y - s.lastPY);
    if (prog > 8) { s.lastPX = load.x; s.lastPY = load.y; s.stuckTimer = 0; }
    else s.stuckTimer++;

    // ── Per-agent SA with nest-direction bias ──
    const away = s.travelDir < 0;
    const floor = away ? P.retreatFloor : 0.02;

    for (const ag of agents) {
      if (prog > 8) {
        ag.temp = Math.max(floor, ag.temp * ag.saCool);
      } else {
        ag.temp = Math.min(3.0, ag.temp + ag.saHeat);
      }
      if (away && ag.temp < floor) ag.temp = floor;
    }

    // ── Direction reversal ──
    const avgTemp = agents.reduce((s, a) => s + a.temp, 0) / n;
    if (s.stuckTimer > 120 && avgTemp > 0.5) {
      if (Math.random() < 0.012 * avgTemp) {
        s.travelDir *= -1; s.revCount++;
        s.stuckTimer = Math.floor(s.stuckTimer * 0.25);
        s.seekGap = false;
        for (const ag of agents) {
          if (ag.attached) ag.heading += (Math.random() - 0.5) * ag.temp * 0.7;
        }
      }
      if (Math.random() < 0.02 * avgTemp) {
        load.va += (Math.random() - 0.5) * 0.018 * avgTemp;
      }
    }

    // ── Gap seeking ──
    const nearW = [1, 2].find(i => Math.abs(load.x - CW * i) < 38);
    if (nearW !== undefined && !s.seekGap) {
      s.seekGap = true;
      s.gapTgt = nearSlit(load.x, load.y, s.travelDir, slitW);
    }
    if (s.seekGap && nearW === undefined) s.seekGap = false;

    // ── Goal angles ──
    // Nest bias: blend pure rightward (0) with current travelDir goal
    // nestBias=1 means always aim nest-ward even during retreat
    const nestAngle = 0; // nest is always right
    const rawGoal = s.travelDir > 0 ? 0 : Math.PI;
    const baseGoal = rawGoal + norm(nestAngle - rawGoal) * P.nestBias * (s.travelDir < 0 ? 1 : 0);

    const slitGoal = s.seekGap && s.gapTgt
      ? Math.atan2(s.gapTgt.y - load.y, s.gapTgt.x - load.x) : baseGoal;
    const wallSlitGoal = s.wallSliding
      ? Math.atan2(nearSlit(load.x, load.y, s.travelDir, slitW).y - load.y,
                    nearSlit(load.x, load.y, s.travelDir, slitW).x - load.x)
      : baseGoal;

    // ── Agent forces ──
    let fx = 0, fy = 0, torque = 0;
    const vs = xv(load.x, load.y, load.a);

    for (const ag of agents) {
      if (!ag.attached) {
        const tl = Math.atan2(load.y - ag.y, load.x - ag.x);
        ag.heading = norm(ag.heading + norm(tl - ag.heading) * 0.13);
        ag.x += Math.cos(ag.heading) * 2;
        ag.y += Math.sin(ag.heading) * 2;
        ag.x = clamp(ag.x, 4, W - 4); ag.y = clamp(ag.y, 4, H - 4);

        let minD = Infinity;
        for (let i = 0; i < vs.length; i++) {
          const j = (i + 1) % vs.length;
          const ex = vs[j].x - vs[i].x, ey = vs[j].y - vs[i].y;
          const l2 = ex * ex + ey * ey;
          const t = l2 === 0 ? 0 : clamp(((ag.x - vs[i].x) * ex + (ag.y - vs[i].y) * ey) / l2, 0, 1);
          const d = Math.hypot(ag.x - (vs[i].x + t * ex), ag.y - (vs[i].y + t * ey));
          if (d < minD) minD = d;
        }
        if (minD < 11) {
          ag.attached = true;
          const dx = ag.x - load.x, dy = ag.y - load.y;
          ag.offA = Math.atan2(dy, dx) - load.a;
          ag.offD = Math.hypot(dx, dy);
        }
        continue;
      }

      const wa = load.a + ag.offA;
      ag.x = load.x + Math.cos(wa) * ag.offD;
      ag.y = load.y + Math.sin(wa) * ag.offD;

      let goal;
      if (ag.usesWallSlide && s.wallSliding) goal = wallSlitGoal;
      else if (ag.usesGapSeek && s.seekGap) goal = slitGoal;
      else goal = baseGoal;

      const noise = ag.wander + ag.temp * 0.018;
      ag.heading = norm(ag.heading * ag.persist + goal * (1 - ag.persist) + (Math.random() - 0.5) * noise);

      if (Math.random() < ag.detachRate * (1 + ag.temp * 0.4)) { ag.attached = false; continue; }

      const f = ag.fScale * 0.85;
      const ffx = Math.cos(ag.heading) * f, ffy = Math.sin(ag.heading) * f;
      fx += ffx; fy += ffy;
      torque += (ag.x - load.x) * ffy - (ag.y - load.y) * ffx;
    }

    // ── Load physics ──
    const mass = 7 + n * 0.2, inertia = mass * 650;
    load.vx = (load.vx + fx / mass * dt) * 0.91;
    load.vy = (load.vy + fy / mass * dt) * 0.91;
    load.va = (load.va + torque / inertia * dt) * 0.87;

    let nx = load.x + load.vx, ny = load.y + load.vy, na = load.a + load.va;

    s.wallSliding = false;
    for (let i = 0; i < 5; i++) {
      const c = resolveCol(nx, ny, na, slitW);
      if (!c.hit) break;
      nx += c.px * 0.35; ny += c.py * 0.35;
      s.wallSliding = true;
      if (c.px !== 0) load.vx *= 0.22;
      if (c.py !== 0) load.vy *= 0.22;
    }

    if (isOk(nx, ny, na, slitW)) { load.x = nx; load.y = ny; load.a = na; }
    else { load.vx *= -0.15; load.vy *= -0.15; load.va *= -0.04; s.wallSliding = true; }

    s.steps++;
    if (s.steps % 4 === 0) {
      s.trail.push({ x: load.x, y: load.y });
      if (s.trail.length > 4000) s.trail.shift();
    }
    if (load.x > CW * 2 + 28) { s.solved = true; setSolved(true); }

    if (s.steps % 12 === 0) {
      const sl = agents.filter(a => a.pop === "slider");
      const pu = agents.filter(a => a.pop === "pusher");
      const aTS = sl.length ? sl.reduce((s, a) => s + a.temp, 0) / sl.length : 0;
      const aTP = pu.length ? pu.reduce((s, a) => s + a.temp, 0) / pu.length : 0;
      setStats({
        steps: s.steps, ch: getCh(load.x) + 1,
        sliders: sl.length, pushers: pu.length,
        avgTempS: aTS.toFixed(2), avgTempP: aTP.toFixed(2),
        dir: s.travelDir > 0 ? "\u2192" : "\u2190",
      });
    }
  }, []);

  // ── Draw ──
  const draw = useCallback(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const s = sim.current;
    if (!s) return;
    const P = params.current;
    const slitW = P.gapWidth;
    const slitY = (H - slitW) / 2;
    const walls = makeWalls(slitW);

    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    ctx.scale(dpr, dpr);

    // BG
    ctx.fillStyle = "#060910"; ctx.fillRect(0, 0, W, H);
    ["#0a0f19", "#0c1220", "#0e1526"].forEach((col, i) => {
      ctx.fillStyle = col; ctx.fillRect(CW * i + 2, 2, CW - 4, H - 4);
    });
    ctx.fillStyle = "rgba(34,197,94,0.035)";
    ctx.fillRect(CW * 2 + 2, 2, CW - 4, H - 4);

    // Slit highlights
    for (let i = 1; i <= 2; i++) {
      ctx.fillStyle = "rgba(59,130,246,0.08)";
      ctx.fillRect(CW * i - 5, slitY, 10, slitW);
    }

    // Trail
    if (s.trail.length > 1) {
      ctx.lineWidth = 1.1; ctx.lineCap = "round";
      for (let i = 1; i < s.trail.length; i++) {
        ctx.strokeStyle = s.trail[i].x >= s.trail[i - 1].x
          ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)";
        ctx.beginPath();
        ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y);
        ctx.lineTo(s.trail[i].x, s.trail[i].y);
        ctx.stroke();
      }
    }

    // Walls
    ctx.strokeStyle = "#2563eb"; ctx.lineWidth = WT * 1.6; ctx.lineCap = "round";
    for (const w of walls) {
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
    }

    // Labels
    ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "rgba(34,197,94,0.22)";
    ctx.fillText("NEST \u2192", W - 48, H / 2 + 4);
    ctx.fillStyle = "rgba(100,116,139,0.25)";
    ctx.fillText("START", CW * 0.42, 18);

    // T-load
    const vs = xv(s.load.x, s.load.y, s.load.a);
    ctx.beginPath(); ctx.moveTo(vs[0].x, vs[0].y);
    for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i].x, vs[i].y);
    ctx.closePath();
    const tc = s.solved ? "#22c55e" : s.travelDir > 0 ? "#ef4444" : "#f59e0b";
    const g = ctx.createLinearGradient(s.load.x - 28, s.load.y - 22, s.load.x + 28, s.load.y + 22);
    g.addColorStop(0, tc); g.addColorStop(1, tc + "aa");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = tc + "66"; ctx.lineWidth = 1.2; ctx.stroke();

    // Arrow
    const aa = s.travelDir > 0 ? 0 : Math.PI;
    const ax = s.load.x + Math.cos(aa) * 16, ay = s.load.y + Math.sin(aa) * 16;
    ctx.beginPath(); ctx.moveTo(s.load.x, s.load.y); ctx.lineTo(ax, ay);
    ctx.strokeStyle = "#fffc"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(aa - .5) * 5, ay - Math.sin(aa - .5) * 5);
    ctx.lineTo(ax - Math.cos(aa + .5) * 5, ay - Math.sin(aa + .5) * 5);
    ctx.closePath(); ctx.fillStyle = "#fffc"; ctx.fill();

    ctx.beginPath(); ctx.arc(s.load.x, s.load.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();

    // Agents
    for (const ag of s.agents) {
      const p = POP[ag.pop];
      const tg = Math.min(1, ag.temp / 2);
      ctx.beginPath(); ctx.arc(ag.x, ag.y, 2.8, 0, Math.PI * 2);
      if (ag.attached) {
        ctx.fillStyle = p.attachColor;
        if (ag.temp > 0.6) {
          ctx.save();
          ctx.strokeStyle = ag.pop === "slider"
            ? `rgba(34,211,238,${tg * 0.4})` : `rgba(249,115,22,${tg * 0.4})`;
          ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }
      } else { ctx.fillStyle = p.color + "40"; }
      ctx.fill();
      if (ag.attached) {
        ctx.beginPath(); ctx.moveTo(ag.x, ag.y);
        ctx.lineTo(ag.x + Math.cos(ag.heading) * 4.5, ag.y + Math.sin(ag.heading) * 4.5);
        ctx.strokeStyle = p.color + "55"; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }

    // HUD
    let hy = 16;
    ctx.textAlign = "left"; ctx.font = "bold 9px monospace";
    if (s.wallSliding) { ctx.fillStyle = "rgba(34,211,238,0.6)"; ctx.fillText("\u25CF WALL-SLIDE", 8, hy); hy += 12; }
    if (s.seekGap) { ctx.fillStyle = "rgba(34,197,94,0.5)"; ctx.fillText("\u25CF GAP-SEEK", 8, hy); hy += 12; }
    const sl = s.agents.filter(a => a.pop === "slider");
    const pu = s.agents.filter(a => a.pop === "pusher");
    const aTS = sl.length ? sl.reduce((s, a) => s + a.temp, 0) / sl.length : 0;
    const aTP = pu.length ? pu.reduce((s, a) => s + a.temp, 0) / pu.length : 0;
    if (aTS > 0.15) { ctx.fillStyle = `rgba(34,211,238,${clamp(aTS/2,.2,.8)})`; ctx.fillText(`\u25CF SLIDER T=${aTS.toFixed(2)}`, 8, hy); hy += 12; }
    if (aTP > 0.15) { ctx.fillStyle = `rgba(249,115,22,${clamp(aTP/2,.2,.8)})`; ctx.fillText(`\u25CF PUSHER T=${aTP.toFixed(2)}`, 8, hy); }
  }, []);

  // ── Loop ──
  useEffect(() => {
    if (!running) { if (raf.current) cancelAnimationFrame(raf.current); return; }
    const loop = () => {
      if (!running) return;
      for (let i = 0; i < speed; i++) tick();
      draw();
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [running, tick, draw, speed]);

  const reset = () => { setRunning(false); init(); setTimeout(draw, 30); };
  const tC = v => parseFloat(v) > 1.2 ? "#ef4444" : parseFloat(v) > 0.4 ? "#f59e0b" : "#22c55e";

  // ── Slider helper component ──
  const Slider = ({ label, color, value, min, max, step, onChange, fmt }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9, color, fontWeight: 700, minWidth: 72, textAlign: "right" }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: 68, accentColor: color }} />
      <span style={{ fontSize: 10, color, minWidth: 32, fontWeight: 600 }}>{fmt ? fmt(value) : value}</span>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#030509",
      color: "#cbd5e1", fontFamily: "'JetBrains Mono','Fira Code',monospace",
      padding: 16, display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <h1 style={{
        fontSize: 18, fontWeight: 900, letterSpacing: ".06em", margin: 0,
        background: "linear-gradient(90deg,#06b6d4,#f97316)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>ANT PIANO-MOVERS — TWO POPULATIONS</h1>
      <p style={{ fontSize: 9.5, color: "#475569", margin: "3px 0 6px", maxWidth: 700, textAlign: "center", lineHeight: 1.5 }}>
        After Dreyer et al. PNAS 2025 — <span style={{ color: "#22d3ee" }}>Sliders</span> (wall-slide, fast SA) +{" "}
        <span style={{ color: "#fb923c" }}>Pushers</span> (brute force, slow SA). Tuneable parameters below.
      </p>

      {/* ── Control panels ── */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap", justifyContent: "center",
      }}>
        {/* Population panel */}
        <div style={{
          padding: "7px 14px", background: "#0a0f18", borderRadius: 5,
          border: "1px solid #151d2b", display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ fontSize: 8, color: "#334155", fontWeight: 700, letterSpacing: ".12em", textAlign: "center" }}>POPULATIONS</div>
          <Slider label="SLIDERS" color="#22d3ee" value={sliderCount} min={5} max={80} step={1}
            onChange={v => { setSliderCount(v); setRunning(false); }} />
          <Slider label="PUSHERS" color="#fb923c" value={pusherCount} min={5} max={80} step={1}
            onChange={v => { setPusherCount(v); setRunning(false); }} />
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textAlign: "center" }}>
            TOTAL: {sliderCount + pusherCount}
          </div>
        </div>

        {/* Tuning panel */}
        <div style={{
          padding: "7px 14px", background: "#0a0f18", borderRadius: 5,
          border: "1px solid #151d2b", display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ fontSize: 8, color: "#334155", fontWeight: 700, letterSpacing: ".12em", textAlign: "center" }}>PARAMETERS</div>
          <Slider label="TEMP FLOOR" color="#ef4444" value={retreatFloor} min={0.1} max={1.8} step={0.05}
            onChange={setRetreatFloor} fmt={v => v.toFixed(2)} />
          <Slider label="NEST BIAS" color="#22c55e" value={nestBias} min={0} max={1} step={0.05}
            onChange={setNestBias} fmt={v => (v * 100).toFixed(0) + "%"} />
          <Slider label="GAP WIDTH" color="#3b82f6" value={gapWidth} min={20} max={120} step={2}
            onChange={v => { setGapWidth(v); setRunning(false); init(); setTimeout(draw, 30); }}
            fmt={v => v + "px"} />
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: "relative", border: "2px solid #1a2030", borderRadius: 6, overflow: "hidden" }}>
        <canvas ref={cvs} style={{ width: W, height: H, display: "block" }} />
        {solved && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
          }}>
            <div style={{
              padding: "16px 36px", background: "rgba(34,197,94,.12)",
              border: "2px solid #22c55e", borderRadius: 8, textAlign: "center",
            }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#22c55e" }}>SOLVED</div>
              <div style={{ fontSize: 11, color: "#86efac", marginTop: 3 }}>{stats.steps.toLocaleString()} steps</div>
            </div>
          </div>
        )}
      </div>

      {/* Transport controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => setRunning(!running)} style={{
          padding: "7px 22px", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
          border: "2px solid #2563eb", borderRadius: 5,
          background: running ? "#2563eb18" : "#2563eb", color: running ? "#2563eb" : "#fff",
          cursor: "pointer", minWidth: 78,
        }}>{running ? "PAUSE" : "RUN"}</button>
        <button onClick={reset} style={{
          padding: "7px 16px", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
          border: "2px solid #1e293b", borderRadius: 5, background: "#0c1017",
          color: "#64748b", cursor: "pointer",
        }}>RESET</button>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 10 }}>
          <span style={{ fontSize: 9, color: "#475569" }}>SPEED</span>
          <input type="range" min={1} max={16} value={speed}
            onChange={e => setSpeed(+e.target.value)}
            style={{ width: 80, accentColor: "#2563eb" }} />
          <span style={{ fontSize: 10, color: "#64748b", minWidth: 22 }}>{speed}\u00d7</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: "flex", gap: 12, marginTop: 8, padding: "7px 16px",
        background: "#0a0f18", borderRadius: 5, border: "1px solid #151d2b",
        flexWrap: "wrap", justifyContent: "center",
      }}>
        {[
          { l: "SLIDERS", v: stats.sliders, c: "#22d3ee" },
          { l: "S-TEMP", v: stats.avgTempS, c: tC(stats.avgTempS) },
          { l: "PUSHERS", v: stats.pushers, c: "#fb923c" },
          { l: "P-TEMP", v: stats.avgTempP, c: tC(stats.avgTempP) },
          { l: "CH", v: `${stats.ch}/3`, c: "#2563eb" },
          { l: "DIR", v: stats.dir, c: stats.dir === "\u2192" ? "#22c55e" : "#f59e0b" },
          { l: "STEPS", v: typeof stats.steps === "number" ? stats.steps.toLocaleString() : stats.steps, c: "#64748b" },
        ].map(s => (
          <div key={s.l} style={{ textAlign: "center", minWidth: 40 }}>
            <div style={{ fontSize: 7, color: "#334155", fontWeight: 700, letterSpacing: ".12em" }}>{s.l}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: s.c, marginTop: 1 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        maxWidth: 740, marginTop: 10, padding: "10px 14px",
        background: "#080c13", borderRadius: 6, border: "1px solid #151d2b",
        fontSize: 10, lineHeight: 1.65, color: "#7c8ba0",
      }}>
        <div style={{ fontWeight: 800, color: "#cbd5e1", marginBottom: 4, fontSize: 10.5 }}>TUNEABLE PARAMETERS</div>
        <p style={{ margin: "0 0 5px" }}>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>Temp Floor</span> — Minimum temperature when retreating (← away from nest).
          Higher = more restless during retreat, faster reversal back to nestward. At 0.1 the ants are calm retreating; at 1.8 they're frantic.
        </p>
        <p style={{ margin: "0 0 5px" }}>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>Nest Bias</span> — How strongly agents pull nestward even during retreat.
          At 0% retreat is purely leftward; at 100% even retreating agents angle back right, creating tighter oscillations.
        </p>
        <p style={{ margin: 0 }}>
          <span style={{ color: "#3b82f6", fontWeight: 700 }}>Gap Width</span> — Width of the slits between chambers (resets sim).
          Narrow gaps require precise rotation of the T-shape; wide gaps are easy. Try 24px for a real challenge.
        </p>
      </div>
    </div>
  );
}
