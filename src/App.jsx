import { useState, useEffect, useRef, useMemo } from "react";

// ─── DESIGN SYSTEM ──────────────────────────────────────────────
// Investor-grade dark theme inspired by Stripe/Linear/Vercel
// Rule: max 6 colors. Color is signal, never decoration.

const T = {
  bg:         "#0A0A0F",
  surface:    "#131318",
  surfaceAlt: "#1A1A21",
  border:     "rgba(255,255,255,0.08)",
  borderHov:  "rgba(255,255,255,0.14)",
  text:       "#FAFAFA",
  textSec:    "#A1A1AA",
  textMute:   "#71717A",
  accent:     "#2563EB",
  accentGlow: "rgba(37,99,235,0.15)",
  green:      "#10B981",
  greenGlow:  "rgba(16,185,129,0.12)",
  red:        "#EF4444",
  redGlow:    "rgba(239,68,68,0.12)",
  amber:      "#F59E0B",
  amberGlow:  "rgba(245,158,11,0.12)",
  radius:     10,
};

const VERT_ACCENT = {
  "Workplace Safety": "#F97316",
  Athletics:          "#3B82F6",
  Military:           "#10B981",
  Healthcare:         "#8B5CF6",
};

// ─── API CONFIG ─────────────────────────────────────────────────
// Set VITE_API_URL env var in Railway, or defaults to function-bun internal URL
const API_URL = import.meta.env.VITE_API_URL || "";

async function fetchAPI(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

// Postgres NUMERIC columns come back as strings — coerce to numbers
function numify(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(numify);
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && v !== "" && !isNaN(v) && !k.includes("date") && !k.includes("name") && !k.includes("hash")) {
      out[k] = Number(v);
    }
  }
  return out;
}

function useData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [snapshot, company_goal, verticals, regions, history] = await Promise.all([
        fetchAPI("/api/snapshot"),
        fetchAPI("/api/goals"),
        fetchAPI("/api/verticals"),
        fetchAPI("/api/regions"),
        fetchAPI("/api/history"),
      ]);
      setData({
        snapshot: numify(snapshot) || {},
        company_goal: numify(company_goal) || { annual_target: 0, q1_target: 0 },
        verticals: numify(verticals) || [],
        regions: numify(regions) || [],
        history: numify(history) || [],
      });
      setError(null);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveGoals = async (goals) => {
    await fetch(`${API_URL}/api/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(goals),
    });
    load(); // refresh after save
  };

  return { data, loading, error, reload: load, saveGoals };
}

// ─── UTILITIES ──────────────────────────────────────────────────

const fmt = (n) => {
  const v = n || 0;
  if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtNum = (n) => n.toLocaleString();

// ─── ANIMATED NUMBER ────────────────────────────────────────────

function AnimatedValue({ value, formatter = (v) => v }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const target = typeof value === "number" ? value : parseFloat(value) || 0;
    const start = 0;
    const duration = 400;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (target - start) * eased);
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };

    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);

  return <>{formatter(display)}</>;
}

// ─── AREA CHART (SVG) ───────────────────────────────────────────

function AreaChart({ data, width = 320, height = 80, color = T.accent, id = "chart" }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={color} />
    </svg>
  );
}

// ─── SPARKLINE ──────────────────────────────────────────────────

function Sparkline({ data, width = 80, height = 24, color = T.accent }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── TREND BADGE ────────────────────────────────────────────────

function TrendBadge({ value = 0, label }) {
  const v = value ?? 0;
  const isUp = v > 0;
  const isDown = v < 0;
  const color = isUp ? T.green : isDown ? T.red : T.amber;
  const bg = isUp ? T.greenGlow : isDown ? T.redGlow : T.amberGlow;
  const arrow = isUp ? "\u2191" : isDown ? "\u2193" : "\u2192";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11, fontWeight: 500, color,
      background: bg, padding: "2px 8px", borderRadius: 4,
    }}>
      {arrow} {isUp ? "+" : ""}{v.toFixed(1)}%{label ? ` ${label}` : ""}
    </span>
  );
}

// ─── METRIC CARD ────────────────────────────────────────────────

function MetricCard({ label, value, trend, trendLabel, sparkData, sparkColor, highlight }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${highlight ? "rgba(37,99,235,0.3)" : T.border}`,
      borderRadius: T.radius,
      padding: "16px 18px",
      position: "relative",
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {highlight && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${T.accent}, ${T.green})`,
        }} />
      )}
      <p style={{
        fontSize: 11, fontWeight: 500, color: T.textMute, margin: 0,
        textTransform: "uppercase", letterSpacing: "0.05em",
      }}>{label}</p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
        <p style={{
          fontSize: 28, fontWeight: 600, color: T.text, margin: 0,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}>{value}</p>
        {sparkData && (
          <Sparkline data={sparkData} color={sparkColor || T.accent} width={64} height={24} />
        )}
      </div>
      {trend !== undefined && (
        <div style={{ marginTop: 8 }}>
          <TrendBadge value={trend} label={trendLabel} />
        </div>
      )}
    </div>
  );
}

// ─── PROGRESS BAR ───────────────────────────────────────────────

function GoalProgress({ label, current, target, color, subtitle }) {
  const pctValue = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const statusColor = pctValue >= 85 ? T.green : pctValue >= 70 ? T.amber : T.red;
  const barColor = color || statusColor;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</span>
          {subtitle && <span style={{ fontSize: 11, color: T.textMute, marginLeft: 8 }}>{subtitle}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.textSec, fontVariantNumeric: "tabular-nums" }}>
            {fmt(current)} / {fmt(target)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: statusColor,
            fontVariantNumeric: "tabular-nums",
          }}>
            {pctValue.toFixed(0)}%
          </span>
        </div>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          width: `${pctValue}%`, height: "100%",
          background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
          borderRadius: 3, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
    </div>
  );
}

// ─── SPLIT BAR ──────────────────────────────────────────────────

function RevenueComposition({ newRevenue, existingRevenue, newDeals, existingDeals }) {
  const total = newRevenue + existingRevenue;
  const newPct = total > 0 ? (newRevenue / total) * 100 : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 2, height: 32, borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          width: `${newPct}%`, background: T.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
          minWidth: newPct > 5 ? "auto" : 0,
        }}>
          {newPct > 15 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
              New {Math.round(newPct)}%
            </span>
          )}
        </div>
        <div style={{
          width: `${100 - newPct}%`, background: T.green,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
            Existing {Math.round(100 - newPct)}%
          </span>
        </div>
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 12, color: T.textSec, marginTop: 8,
        fontVariantNumeric: "tabular-nums",
      }}>
        <span>{fmt(newRevenue)} from {newDeals} new customers</span>
        <span>{fmt(existingRevenue)} from {existingDeals} existing</span>
      </div>
    </div>
  );
}

// ─── SECTION CARD ───────────────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      padding: "20px 22px",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{
          fontSize: 12, fontWeight: 600, color: T.textSec, margin: 0,
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── GOALS EDITOR MODAL ─────────────────────────────────────────

function GoalsEditor({ goals, onSave, onClose }) {
  const [annual, setAnnual] = useState(goals?.annual_target || 0);
  const [q1, setQ1] = useState(goals?.q1_target || 0);
  const [q2, setQ2] = useState(goals?.q2_target || 0);
  const [q3, setQ3] = useState(goals?.q3_target || 0);
  const [q4, setQ4] = useState(goals?.q4_target || 0);

  const inputStyle = {
    width: "100%", padding: "8px 12px", fontSize: 14,
    background: T.surfaceAlt, border: `1px solid ${T.border}`,
    borderRadius: 6, color: T.text, outline: "none",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100,
    }}
    onClick={onClose}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: 28, maxWidth: 440, width: "100%",
        boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
      }}
      onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: T.text, margin: 0 }}>
            {new Date().getFullYear()} Financial Goals
          </h2>
          <button onClick={onClose} style={{
            border: "none", background: T.surfaceAlt, width: 28, height: 28,
            borderRadius: 6, cursor: "pointer", color: T.textMute, fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>x</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
            Annual Revenue Target
          </label>
          <input type="number" value={annual} onChange={e => setAnnual(Number(e.target.value))} style={inputStyle} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[["Q1", q1, setQ1], ["Q2", q2, setQ2], ["Q3", q3, setQ3], ["Q4", q4, setQ4]].map(([label, val, setter]) => (
            <div key={label}>
              <label style={{ fontSize: 11, fontWeight: 500, color: T.textMute, display: "block", marginBottom: 6 }}>{label}</label>
              <input type="number" value={val} onChange={e => setter(Number(e.target.value))} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", fontSize: 13, fontWeight: 500, borderRadius: 6,
            border: `1px solid ${T.border}`, background: "transparent",
            color: T.textSec, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => { onSave({ annual_target: annual, q1_target: q1, q2_target: q2, q3_target: q3, q4_target: q4 }); onClose(); }}
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 600, borderRadius: 6,
              border: "none", background: T.accent, color: "#fff", cursor: "pointer",
            }}>Save Goals</button>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR NAV ────────────────────────────────────────────────

function Sidebar({ view, setView }) {
  const items = [
    { key: "overview", label: "Overview", icon: "\u25A6" },
    { key: "verticals", label: "Verticals", icon: "\u25CE" },
    { key: "regions", label: "Regions", icon: "\u25C9" },
  ];

  return (
    <div style={{
      width: 56, minHeight: "100vh", background: T.surface,
      borderRight: `1px solid ${T.border}`, padding: "20px 0",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      position: "fixed", left: 0, top: 0,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `linear-gradient(135deg, ${T.accent}, ${T.green})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 20,
      }}>M</div>
      {items.map((item) => (
        <button key={item.key} onClick={() => setView(item.key)} title={item.label}
          style={{
            width: 40, height: 40, borderRadius: 8, border: "none",
            background: view === item.key ? T.accentGlow : "transparent",
            color: view === item.key ? T.accent : T.textMute,
            cursor: "pointer", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
          {item.icon}
        </button>
      ))}
    </div>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────

export default function MX3Dashboard() {
  const { data, loading, error, reload, saveGoals } = useData();
  const [view, setView] = useState("overview");
  const [showGoals, setShowGoals] = useState(false);

  if (loading) return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: T.bg, color: T.textMute, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 12,
    }}>
      <div style={{ fontSize: 14 }}>Loading dashboard...</div>
    </div>
  );

  if (error || !data) return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: T.bg, color: T.red, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 12,
    }}>
      <div style={{ fontSize: 14 }}>Failed to load: {error}</div>
      <button onClick={reload} style={{
        padding: "8px 20px", fontSize: 13, borderRadius: 6,
        border: `1px solid ${T.border}`, background: T.surface,
        color: T.text, cursor: "pointer",
      }}>Retry</button>
    </div>
  );

  const EMPTY_SNAPSHOT = {
    snapshot_date: new Date().toISOString().split("T")[0],
    revenue_wtd: 0, revenue_mtd: 0, revenue_qtd: 0, revenue_ytd: 0,
    deals_closed_wtd: 0, deals_closed_mtd: 0, deals_closed_qtd: 0, deals_closed_ytd: 0,
    avg_order_size: 0, sales_velocity_days: 0, daily_inbound_leads: 0, leads_7day_avg: 0,
    new_customer_deals: 0, new_customer_revenue: 0, existing_customer_deals: 0, existing_customer_revenue: 0,
    total_devices_sold_ytd: 0, total_strips_sold_ytd: 0, strips_per_device: 0,
    revenue_mom_pct: 0, lead_volume_mom_pct: 0, new_customers_mom_pct: 0,
  };
  const s = { ...EMPTY_SNAPSHOT, ...data.snapshot };
  const goal = { annual_target: 0, q1_target: 0, ...data.company_goal };

  const ytdPct = goal.annual_target > 0 ? (s.revenue_ytd / goal.annual_target) * 100 : 0;
  const expectedPace = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return ((now - start) / (end - start)) * 100;
  })();
  const onPace = ytdPct >= expectedPace * 0.95;

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: T.bg, color: T.text, minHeight: "100vh",
      fontVariantNumeric: "tabular-nums",
    }}>
      {showGoals && (
        <GoalsEditor goals={goal} onSave={saveGoals} onClose={() => setShowGoals(false)} />
      )}

      <Sidebar view={view} setView={setView} />

      <div style={{ marginLeft: 56, padding: "28px 36px", maxWidth: 1100 }}>

        {/* ─── TOP BAR ─────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>MX3 Diagnostics</h1>
            <p style={{ fontSize: 12, color: T.textMute, margin: "4px 0 0" }}>
              Last refreshed {new Date(s.snapshot_date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at 6:00 AM CST
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              background: T.green, boxShadow: `0 0 6px ${T.green}`,
            }} />
            <span style={{ fontSize: 11, color: T.textMute }}>All systems operational</span>
            <button onClick={() => setShowGoals(true)} style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 6,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.textSec, cursor: "pointer", marginLeft: 12,
            }}>Edit Goals</button>
          </div>
        </div>

        {/* ─── HERO: YTD GOAL PROGRESS ─────────────────────── */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: T.radius, padding: "22px 24px", marginBottom: 14,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: onPace
              ? `linear-gradient(90deg, ${T.green}, ${T.accent})`
              : `linear-gradient(90deg, ${T.amber}, ${T.red})`,
          }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, color: T.textMute, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                YTD Revenue vs. Annual Goal
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: T.text, lineHeight: 1 }}>
                  <AnimatedValue value={s.revenue_ytd} formatter={(v) => fmt(Math.round(v))} />
                </span>
                <span style={{ fontSize: 16, color: T.textMute }}>/ {fmt(goal.annual_target)}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{
                fontSize: 28, fontWeight: 700,
                color: onPace ? T.green : T.amber,
              }}>{ytdPct.toFixed(1)}%</span>
              <p style={{ fontSize: 11, color: T.textMute, margin: "4px 0 0" }}>
                {onPace ? "On pace" : "Behind pace"} (expected {expectedPace.toFixed(0)}%)
              </p>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
              <div style={{
                width: `${Math.min(ytdPct, 100)}%`, height: "100%",
                background: onPace
                  ? `linear-gradient(90deg, ${T.green}, ${T.accent})`
                  : `linear-gradient(90deg, ${T.amber}, ${T.red})`,
                borderRadius: 4,
                transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
              }} />
              <div style={{
                position: "absolute", left: `${expectedPace}%`, top: -3, width: 2, height: 14,
                background: T.textMute, borderRadius: 1, opacity: 0.6,
              }} />
            </div>
          </div>
        </div>

        {/* ─── OVERVIEW VIEW ───────────────────────────────── */}
        {view === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 14 }}>
              <MetricCard label="WTD Revenue" value={fmt(s.revenue_wtd)} trend={12} trendLabel="vs last wk" highlight />
              <MetricCard label="MTD Revenue" value={fmt(s.revenue_mtd)} trend={s.revenue_mom_pct} trendLabel="MoM" />
              <MetricCard label="QTD Revenue" value={fmt(s.revenue_qtd)} sparkData={data.history.map(h => h.revenue)} sparkColor={T.green} />
              <MetricCard label="Avg Order" value={fmt(s.avg_order_size)} trend={8} trendLabel="vs prior mo" />
              <MetricCard label="Sales Velocity" value={`${s.sales_velocity_days}d`} trend={-3} trendLabel="days" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Section title="Revenue Trend (30 Days)">
                <AreaChart
                  data={data.history.map(h => h.revenue)}
                  width={460} height={120} color={T.accent} id="rev"
                />
              </Section>

              <Section title="Growth Signals (MoM)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  {[
                    ["Revenue", s.revenue_mom_pct],
                    ["Lead Volume", s.lead_volume_mom_pct],
                    ["New Customers", s.new_customers_mom_pct],
                  ].map(([label, val]) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: T.textMute, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                      <p style={{
                        fontSize: 24, fontWeight: 700, margin: "8px 0 4px",
                        color: (val||0) > 0 ? T.green : T.red,
                      }}>
                        {(val||0) > 0 ? "+" : ""}{(val||0).toFixed(1)}%
                      </p>
                      <Sparkline
                        data={label === "Revenue" ? data.history.map(h => h.revenue) : data.history.map(h => h.leads)}
                        color={(val||0) > 0 ? T.green : T.red} width={60} height={18}
                      />
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Section title="Customer Revenue Mix (MTD)">
                <RevenueComposition
                  newRevenue={s.new_customer_revenue}
                  existingRevenue={s.existing_customer_revenue}
                  newDeals={s.new_customer_deals}
                  existingDeals={s.existing_customer_deals}
                />
              </Section>

              <Section title="Product Intelligence (YTD)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    ["Devices Sold", s.total_devices_sold_ytd, null],
                    ["Strip Packs", s.total_strips_sold_ytd, null],
                    ["Strips/Device", (s.strips_per_device||0).toFixed(1), T.green],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{
                      background: T.surfaceAlt, borderRadius: 8, padding: "14px 12px", textAlign: "center",
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 500, color: T.textMute, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                      <p style={{
                        fontSize: 22, fontWeight: 700, margin: "6px 0 0",
                        color: color || T.text,
                      }}>{val}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <Section title="Daily Inbound Leads">
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div>
                  <span style={{ fontSize: 32, fontWeight: 700 }}>{s.daily_inbound_leads}</span>
                  <span style={{ fontSize: 13, color: T.textMute, marginLeft: 8 }}>today</span>
                </div>
                <div style={{ fontSize: 12, color: T.textSec }}>
                  7-day avg: <strong style={{ color: T.text }}>{s.leads_7day_avg}</strong>
                </div>
                <div style={{ flex: 1 }}>
                  <AreaChart data={data.history.map(h => h.leads)} width={400} height={48} color={T.accent} id="leads" />
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ─── VERTICALS VIEW ──────────────────────────────── */}
        {view === "verticals" && (
          <>
            <Section title="QTD Revenue by Vertical vs. Goal">
              {data.verticals.map((v) => (
                <GoalProgress
                  key={v.name} label={v.name}
                  current={v.revenue_qtd} target={v.goal_qtd}
                  color={VERT_ACCENT[v.name]}
                  subtitle={`${v.deals_closed_qtd} deals`}
                />
              ))}
            </Section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              {data.verticals.map((v) => {
                const accent = VERT_ACCENT[v.name];
                const pct = v.goal_qtd > 0 ? (v.revenue_qtd / v.goal_qtd * 100) : 0;
                return (
                  <div key={v.name} style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: T.radius, padding: "18px 16px",
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3,
                      background: accent,
                    }} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0 }}>{v.name}</p>
                    <p style={{
                      fontSize: 24, fontWeight: 700, margin: "10px 0 4px",
                      fontVariantNumeric: "tabular-nums",
                    }}>{fmt(v.revenue_qtd)}</p>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: pct >= 85 ? T.green : pct >= 70 ? T.amber : T.red,
                    }}>{pct.toFixed(0)}% of goal</span>
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                      marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`,
                    }}>
                      <div>
                        <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>New</p>
                        <p style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 0" }}>{v.new_customer_deals}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>Existing</p>
                        <p style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 0" }}>{v.existing_customer_deals}</p>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>Strips/Device</p>
                        <p style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 0", color: T.green }}>{v.strips_per_device}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── REGIONS VIEW ────────────────────────────────── */}
        {view === "regions" && (
          <>
            <Section title="QTD Revenue by Region vs. Goal">
              {data.regions.map((r) => (
                <GoalProgress
                  key={r.name} label={r.name}
                  current={r.revenue_qtd} target={r.goal_qtd}
                  subtitle={`${r.deals} deals closed`}
                />
              ))}
            </Section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              {data.regions.map((r) => {
                const pct = r.goal_qtd > 0 ? (r.revenue_qtd / r.goal_qtd * 100) : 0;
                return (
                  <div key={r.name} style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: T.radius, padding: "18px 16px", textAlign: "center",
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{r.name}</p>
                    <p style={{ fontSize: 24, fontWeight: 700, margin: "10px 0 4px", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(r.revenue_qtd)}
                    </p>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: pct >= 85 ? T.green : pct >= 70 ? T.amber : T.red,
                    }}>{pct.toFixed(0)}% of goal</span>
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>Deals Closed</p>
                      <p style={{ fontSize: 18, fontWeight: 600, margin: "2px 0 0" }}>{r.deals}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── FOOTER ──────────────────────────────────────── */}
        <div style={{
          textAlign: "center", padding: "24px 0 12px",
          fontSize: 11, color: T.textMute, letterSpacing: "0.02em",
        }}>
          MX3 Diagnostics Executive Dashboard
        </div>
      </div>
    </div>
  );
}
