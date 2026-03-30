import { useState, useEffect, useRef, useCallback } from "react";

// ── Arena ──
const W = 780, H = 380;
const CW = W / 3;
const SLIT_W = 64;
const SLIT_Y = (H - SLIT_W) / 2;
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

// ── Walls ──
const WALLS = (() => {
  const ws = [[0,0,W,0],[0,H,W,H],[0,0,0,H],[W,0,W,H]];
  for (let i = 1; i <= 2; i++) {
    const x = CW * i;
    ws.push([x, 0, x, SLIT_Y], [x, SLIT_Y + SLIT_W, x, H]);
  }
  return ws.map(([x1,y1,x2,y2]) => ({ x1,y1,x2,y2 }));
})();

const SLITS = [1, 2].map(i => ({ x: CW * i, y: SLIT_Y + SLIT_W / 2 }));

function resolveCol(cx, cy, ang) {
  const vs = xv(cx, cy, ang);
  let px = 0, py = 0, hit = false;
  for (const v of vs) {
    if (v.x < WT) { px += WT - v.x; hit = true; }
    if (v.x > W - WT) { px += (W - WT) - v.x; hit = true; }
    if (v.y < WT) { py += WT - v.y; hit = true; }
    if (v.y > H - WT) { py += (H - WT) - v.y; hit = true; }
    for (let i = 1; i <= 2; i++) {
      const wx = CW * i;
      const inS = v.y > SLIT_Y + 1 && v.y < SLIT_Y + SLIT_W - 1;
      if (!inS && Math.abs(v.x - wx) < WT + 1) {
        px += (v.x < wx ? (wx - WT - 1) : (wx + WT + 1)) - v.x;
        hit = true;
      }
    }
  }
  return { px, py, hit };
}

function isOk(cx, cy, a) {
  for (const v of xv(cx, cy, a)) {
    if (v.x < .5 || v.x > W - .5 || v.y < .5 || v.y > H - .5) return false;
    for (let i = 1; i <= 2; i++) {
      const wx = CW * i;
      if (!(v.y > SLIT_Y + 2 && v.y < SLIT_Y + SLIT_W - 2) && Math.abs(v.x - wx) < WT + .5) return false;
    }
  }
  return true;
}

function getCh(x) { return x < CW ? 0 : x < CW * 2 ? 1 : 2; }

function nearSlit(lx, ly, dir) {
  let best = SLITS[0], bestD = Infinity;
  for (const s of SLITS) {
    const dx = s.x - lx;
    if ((dir > 0 && dx > -25) || (dir < 0 && dx < 25) || Math.abs(dx) < 45) {
      const d = Math.hypot(dx, s.y - ly);
      if (d < bestD) { bestD = d; best = s; }
    }
  }
  return best;
}

// ══════════════════════════════════════════════
//  TWO POPULATIONS
// ══════════════════════════════════════════════
// SLIDER: wall-sliding heuristic, gap-seeking, fast SA (heats/cools quickly)
// PUSHER: direct pushing toward goal, no wall-awareness, slow SA (sluggish adaptation)

const POP = {
  slider: {
    color: "#22d3ee",       // cyan
    attachColor: "#06b6d4",
    persist: 0.965,
    wander: 0.02,
    fScale: 0.32,
    detachRate: 0.0003,
    usesWallSlide: true,
    usesGapSeek: true,
    saHeatRate: 0.0018,     // fast heating when stuck
    saCoolRate: 0.93,       // fast cooling when moving
  },
  pusher: {
    color: "#fb923c",       // orange
    attachColor: "#f97316",
    persist: 0.94,
    wander: 0.045,
    fScale: 0.42,
    detachRate: 0.0006,
    usesWallSlide: false,
    usesGapSeek: false,
    saHeatRate: 0.0004,     // slow heating
    saCoolRate: 0.99,       // slow cooling
  },
};

function makeAgent(x, y, pop) {
  const p = POP[pop];
  return {
    x, y, pop,
    heading: Math.random() * Math.PI * 2,
    attached: false,
    offA: 0, offD: 0,
    persist: p.persist,
    wander: p.wander,
    fScale: p.fScale,
    detachRate: p.detachRate,
    usesWallSlide: p.usesWallSlide,
    usesGapSeek: p.usesGapSeek,
    saHeat: p.saHeatRate,
    saCool: p.saCoolRate,
    // per-agent temperature
    temp: 0.05,
  };
}

function spawnAll(nSliders, nPushers, lx, ly) {
  const agents = [];
  const total = nSliders + nPushers;
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2;
    const r = 40 + Math.random() * 30;
    const pop = i < nSliders ? "slider" : "pusher";
    agents.push(makeAgent(lx + Math.cos(a) * r, ly + Math.sin(a) * r, pop));
  }
  return agents;
}

// ══════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════
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
  const [sliderCount, setSliderCount] = useState(55);
  const [pusherCount, setPusherCount] = useState(45);

  const init = useCallback(() => {
    const lx = CW * 0.42, ly = H / 2;
    sim.current = {
      load: { x: lx, y: ly, a: 0, vx: 0, vy: 0, va: 0 },
      agents: spawnAll(sliderCount, pusherCount, lx, ly),
      trail: [{ x: lx, y: ly }],
      steps: 0, solved: false,
      stuckTimer: 0,
      lastPX: lx, lastPY: ly,
      travelDir: 1,
      wallSliding: false,
      seekGap: false,
      gapTgt: null,
      revCount: 0,
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

    // ── Global stuck detection (for direction reversal) ──
    const prog = Math.hypot(load.x - s.lastPX, load.y - s.lastPY);
    if (prog > 8) {
      s.lastPX = load.x; s.lastPY = load.y; s.stuckTimer = 0;
    } else {
      s.stuckTimer++;
    }

    // ── Per-agent SA + nest-direction bias ──
    const awayFromNest = s.travelDir < 0;

    for (const ag of agents) {
      if (prog > 8) {
        // Cooling — rate depends on population type
        const floor = awayFromNest ? 0.55 : 0.02;
        ag.temp = Math.max(floor, ag.temp * ag.saCool);
      } else {
        // Heating
        ag.temp = Math.min(3.0, ag.temp + ag.saHeat);
      }
      // Enforce floor
      if (awayFromNest && ag.temp < 0.55) ag.temp = 0.55;
    }

    // ── Global direction reversal (driven by hottest agents) ──
    const avgTemp = agents.reduce((s, a) => s + a.temp, 0) / n;
    if (s.stuckTimer > 120 && avgTemp > 0.5) {
      if (Math.random() < 0.012 * avgTemp) {
        s.travelDir *= -1;
        s.revCount++;
        s.stuckTimer = Math.floor(s.stuckTimer * 0.25);
        s.seekGap = false;
        for (const ag of agents) {
          if (ag.attached) ag.heading += (Math.random() - 0.5) * ag.temp * 0.7;
        }
      }
      // Random torque
      if (Math.random() < 0.02 * avgTemp) {
        load.va += (Math.random() - 0.5) * 0.018 * avgTemp;
      }
    }

    // ── Gap seeking (global, but only slider agents use it) ──
    const nearW = [1, 2].find(i => Math.abs(load.x - CW * i) < 38);
    if (nearW !== undefined && !s.seekGap) {
      s.seekGap = true;
      s.gapTgt = nearSlit(load.x, load.y, s.travelDir);
    }
    if (s.seekGap && nearW === undefined) s.seekGap = false;

    // ── Goal angle per agent ──
    const baseGoal = s.travelDir > 0 ? 0 : Math.PI;
    const slitGoal = s.seekGap && s.gapTgt
      ? Math.atan2(s.gapTgt.y - load.y, s.gapTgt.x - load.x)
      : baseGoal;
    const wallSlitGoal = s.wallSliding
      ? Math.atan2(nearSlit(load.x, load.y, s.travelDir).y - load.y,
                    nearSlit(load.x, load.y, s.travelDir).x - load.x)
      : baseGoal;

    // ── Agent forces ──
    let fx = 0, fy = 0, torque = 0;
    const vs = xv(load.x, load.y, load.a);

    for (const ag of agents) {
      if (!ag.attached) {
        // Wander toward load
        const tl = Math.atan2(load.y - ag.y, load.x - ag.x);
        ag.heading = norm(ag.heading + norm(tl - ag.heading) * 0.13);
        ag.x += Math.cos(ag.heading) * 2;
        ag.y += Math.sin(ag.heading) * 2;
        ag.x = clamp(ag.x, 4, W - 4);
        ag.y = clamp(ag.y, 4, H - 4);

        // Attach check
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

      // Attached — position on load
      const wa = load.a + ag.offA;
      ag.x = load.x + Math.cos(wa) * ag.offD;
      ag.y = load.y + Math.sin(wa) * ag.offD;

      // Choose goal based on population type
      let goal;
      if (ag.usesWallSlide && s.wallSliding) {
        goal = wallSlitGoal;
      } else if (ag.usesGapSeek && s.seekGap) {
        goal = slitGoal;
      } else {
        goal = baseGoal;
      }

      // Heading update with per-agent noise scaled by per-agent temperature
      const noise = ag.wander + ag.temp * 0.018;
      ag.heading = norm(
        ag.heading * ag.persist +
        goal * (1 - ag.persist) +
        (Math.random() - 0.5) * noise
      );

      // Detach — higher when hot
      if (Math.random() < ag.detachRate * (1 + ag.temp * 0.4)) {
        ag.attached = false;
        continue;
      }

      // Force
      const f = ag.fScale * 0.85;
      const ffx = Math.cos(ag.heading) * f;
      const ffy = Math.sin(ag.heading) * f;
      fx += ffx; fy += ffy;
      torque += (ag.x - load.x) * ffy - (ag.y - load.y) * ffx;
    }

    // ── Load physics ──
    const mass = 7 + n * 0.2;
    const inertia = mass * 650;
    load.vx = (load.vx + fx / mass * dt) * 0.91;
    load.vy = (load.vy + fy / mass * dt) * 0.91;
    load.va = (load.va + torque / inertia * dt) * 0.87;

    let nx = load.x + load.vx, ny = load.y + load.vy, na = load.a + load.va;

    s.wallSliding = false;
    for (let i = 0; i < 5; i++) {
      const c = resolveCol(nx, ny, na);
      if (!c.hit) break;
      nx += c.px * 0.35; ny += c.py * 0.35;
      s.wallSliding = true;
      if (c.px !== 0) load.vx *= 0.22;
      if (c.py !== 0) load.vy *= 0.22;
    }

    if (isOk(nx, ny, na)) {
      load.x = nx; load.y = ny; load.a = na;
    } else {
      load.vx *= -0.15; load.vy *= -0.15; load.va *= -0.04;
      s.wallSliding = true;
    }

    s.steps++;
    if (s.steps % 4 === 0) {
      s.trail.push({ x: load.x, y: load.y });
      if (s.trail.length > 4000) s.trail.shift();
    }

    if (load.x > CW * 2 + 28) { s.solved = true; setSolved(true); }

    if (s.steps % 12 === 0) {
      const sliders = agents.filter(a => a.pop === "slider");
      const pushers = agents.filter(a => a.pop === "pusher");
      const aTS = sliders.length ? (sliders.reduce((s, a) => s + a.temp, 0) / sliders.length) : 0;
      const aTP = pushers.length ? (pushers.reduce((s, a) => s + a.temp, 0) / pushers.length) : 0;
      setStats({
        steps: s.steps,
        ch: getCh(load.x) + 1,
        sliders: sliders.length,
        pushers: pushers.length,
        avgTempS: aTS.toFixed(2),
        avgTempP: aTP.toFixed(2),
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
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    ctx.scale(dpr, dpr);

    // BG
    ctx.fillStyle = "#060910";
    ctx.fillRect(0, 0, W, H);
    ["#0a0f19", "#0c1220", "#0e1526"].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(CW * i + 2, 2, CW - 4, H - 4);
    });
    ctx.fillStyle = "rgba(34,197,94,0.035)";
    ctx.fillRect(CW * 2 + 2, 2, CW - 4, H - 4);

    // Slit highlights
    for (let i = 1; i <= 2; i++) {
      ctx.fillStyle = "rgba(59,130,246,0.08)";
      ctx.fillRect(CW * i - 5, SLIT_Y, 10, SLIT_W);
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
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = WT * 1.6; ctx.lineCap = "round";
    for (const w of WALLS) {
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

    // Center dot
    ctx.beginPath(); ctx.arc(s.load.x, s.load.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();

    // Agents — draw by population
    for (const ag of s.agents) {
      const p = POP[ag.pop];
      const tempGlow = Math.min(1, ag.temp / 2);
      ctx.beginPath(); ctx.arc(ag.x, ag.y, 2.8, 0, Math.PI * 2);
      if (ag.attached) {
        ctx.fillStyle = p.attachColor;
        // Glow ring when hot
        if (ag.temp > 0.6) {
          ctx.save();
          ctx.strokeStyle = ag.pop === "slider"
            ? `rgba(34,211,238,${tempGlow * 0.4})`
            : `rgba(249,115,22,${tempGlow * 0.4})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      } else {
        ctx.fillStyle = p.color + "40";
      }
      ctx.fill();

      // Heading tick
      if (ag.attached) {
        ctx.beginPath(); ctx.moveTo(ag.x, ag.y);
        ctx.lineTo(ag.x + Math.cos(ag.heading) * 4.5, ag.y + Math.sin(ag.heading) * 4.5);
        ctx.strokeStyle = p.color + "55"; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }

    // HUD
    let hy = 16;
    ctx.textAlign = "left"; ctx.font = "bold 9px monospace";
    if (s.wallSliding) {
      ctx.fillStyle = "rgba(34,211,238,0.6)";
      ctx.fillText("\u25CF WALL-SLIDE", 8, hy); hy += 12;
    }
    if (s.seekGap) {
      ctx.fillStyle = "rgba(34,197,94,0.5)";
      ctx.fillText("\u25CF GAP-SEEK", 8, hy); hy += 12;
    }
    // Show avg temps
    const sliders = s.agents.filter(a => a.pop === "slider");
    const pushers = s.agents.filter(a => a.pop === "pusher");
    const aTS = sliders.length ? sliders.reduce((s, a) => s + a.temp, 0) / sliders.length : 0;
    const aTP = pushers.length ? pushers.reduce((s, a) => s + a.temp, 0) / pushers.length : 0;
    if (aTS > 0.15) {
      ctx.fillStyle = `rgba(34,211,238,${clamp(aTS / 2, 0.2, 0.8)})`;
      ctx.fillText(`\u25CF SLIDER T=${aTS.toFixed(2)}`, 8, hy); hy += 12;
    }
    if (aTP > 0.15) {
      ctx.fillStyle = `rgba(249,115,22,${clamp(aTP / 2, 0.2, 0.8)})`;
      ctx.fillText(`\u25CF PUSHER T=${aTP.toFixed(2)}`, 8, hy);
    }
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

  const tC = (v) => parseFloat(v) > 1.2 ? "#ef4444" : parseFloat(v) > 0.4 ? "#f59e0b" : "#22c55e";

  return (
    <div style={{
      minHeight: "100vh", background: "#030509",
      color: "#cbd5e1", fontFamily: "'JetBrains Mono','Fira Code',monospace",
      padding: 16, display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <h1 style={{
        fontSize: 19, fontWeight: 900, letterSpacing: ".06em", margin: 0,
        background: "linear-gradient(90deg,#06b6d4,#f97316)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>
        ANT PIANO-MOVERS — TWO POPULATIONS
      </h1>
      <p style={{
        fontSize: 10, color: "#475569", margin: "3px 0 8px",
        maxWidth: 700, textAlign: "center", lineHeight: 1.55,
      }}>
        After Dreyer et al. PNAS 2025 — <span style={{ color: "#22d3ee" }}>Sliders</span> (wall-slide + gap-seek, fast SA) and{" "}
        <span style={{ color: "#fb923c" }}>Pushers</span> (direct force, slow SA) cooperate on a T-shaped load.
        Nest-direction bias prevents full cooling when retreating.
      </p>

      {/* Population controls */}
      <div style={{
        display: "flex", gap: 16, marginBottom: 8, padding: "8px 16px",
        background: "#0a0f18", borderRadius: 5, border: "1px solid #151d2b",
        alignItems: "center", flexWrap: "wrap", justifyContent: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#22d3ee", fontWeight: 700 }}>SLIDERS</span>
          <input type="range" min={10} max={80} value={sliderCount}
            onChange={e => { setSliderCount(+e.target.value); setRunning(false); }}
            style={{ width: 70, accentColor: "#06b6d4" }} />
          <span style={{ fontSize: 11, color: "#22d3ee", minWidth: 22 }}>{sliderCount}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#fb923c", fontWeight: 700 }}>PUSHERS</span>
          <input type="range" min={10} max={80} value={pusherCount}
            onChange={e => { setPusherCount(+e.target.value); setRunning(false); }}
            style={{ width: 70, accentColor: "#f97316" }} />
          <span style={{ fontSize: 11, color: "#fb923c", minWidth: 22 }}>{pusherCount}</span>
        </div>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          TOTAL: {sliderCount + pusherCount}
        </span>
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

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
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
        display: "flex", gap: 14, marginTop: 10, padding: "8px 18px",
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
          <div key={s.l} style={{ textAlign: "center", minWidth: 44 }}>
            <div style={{ fontSize: 7.5, color: "#334155", fontWeight: 700, letterSpacing: ".12em" }}>{s.l}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: s.c, marginTop: 1 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        maxWidth: 740, marginTop: 12, padding: "12px 16px",
        background: "#080c13", borderRadius: 6, border: "1px solid #151d2b",
        fontSize: 10.5, lineHeight: 1.7, color: "#7c8ba0",
      }}>
        <div style={{ fontWeight: 800, color: "#cbd5e1", marginBottom: 5, fontSize: 11 }}>TWO POPULATIONS</div>
        <p style={{ margin: "0 0 6px" }}>
          <span style={{ color: "#22d3ee", fontWeight: 700 }}>Sliders (cyan)</span> — Wall-sliding + gap-seeking heuristic with
          <strong> fast SA</strong>: temperature rises quickly when stuck and cools quickly when moving. These agents encode
          the emergent right-hand-rule, scanning walls for slits. They adapt rapidly to new situations.
        </p>
        <p style={{ margin: "0 0 6px" }}>
          <span style={{ color: "#fb923c", fontWeight: 700 }}>Pushers (orange)</span> — Direct force toward the goal with
          <strong> slow SA</strong>: temperature rises slowly and cools slowly. These agents provide steady forward
          drive but are sluggish to adapt when stuck, continuing to push even when it's unproductive.
        </p>
        <p style={{ margin: "0 0 6px" }}>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>Nest bias</span> — When retreating (← away from nest), neither
          population's temperature can cool below 0.55. The collective stays restless and primed to reverse back toward
          home, modelling the ants' innate nest-seeking drive.
        </p>
        <p style={{ margin: 0 }}>
          <span style={{ color: "#64748b", fontWeight: 700 }}>Interaction</span> — The two populations compete on the same load.
          Sliders steer around obstacles; pushers provide brute force. Hot agents glow.
          Adjust the slider/pusher ratio to explore how the mix affects solving speed.
        </p>
      </div>
    </div>
  );
}
