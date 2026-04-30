import { useState, useEffect, useRef } from "react";

// ─── DESIGN SYSTEM ──────────────────────────────────────────────
// Matched to MX3 Executive Dashboard
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

const SECTOR_ACCENT = {
  "Athletics":         "#3B82F6",
  "Workplace Safety":  "#F97316",
  "Healthcare":        "#8B5CF6",
};

// ─── API CONFIG ─────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || "";

async function fetchAPI(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

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

// ─── UTILITIES ──────────────────────────────────────────────────

const fmt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtPct = (n) => {
  if (n == null) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Number(n).toFixed(1)}%`;
};

function getQuarterNum() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

function getQuarterKey() {
  return `q${getQuarterNum()}_revenue`;
}

// ─── ANIMATED NUMBER ────────────────────────────────────────────

function AnimatedValue({ value, formatter = (v) => v }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const target = typeof value === "number" ? value : parseFloat(value) || 0;
    const duration = 400;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
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
  const v = Number(value ?? 0) || 0;
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
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
        }}>{typeof value === "number" ? fmt(value) : value}</p>
        {sparkData && (
          <Sparkline data={sparkData} color={sparkColor || T.accent} width={64} height={24} />
        )}
      </div>
      {trend != null && (
        <div style={{ marginTop: 8 }}>
          <TrendBadge value={Number(trend)} label={trendLabel} />
        </div>
      )}
      {trend == null && trendLabel && (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 11, color: T.textMute }}>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

// ─── SECTION CARD ───────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      padding: "20px 22px",
      marginBottom: 14,
    }}>
      <h3 style={{
        fontSize: 12, fontWeight: 600, color: T.textSec, margin: "0 0 14px",
        textTransform: "uppercase", letterSpacing: "0.04em",
      }}>{title}</h3>
      {children}
    </div>
  );
}

// ─── GOAL PROGRESS BAR ─────────────────────────────────────────

function GoalProgressBar({ label, current, target, subtitle, isCurrency = true }) {
  const cur = Number(current) || 0;
  const tgt = Number(target) || 0;
  const pctRaw = tgt > 0 ? (cur / tgt) * 100 : 0;
  const pctValue = pctRaw;
  const pctBarWidth = Math.min(pctRaw, 100);
  const fmtNum = (n) => isCurrency ? fmt(n) : Math.round(Number(n) || 0).toLocaleString();
  const statusColor = pctValue >= 85 ? T.green : pctValue >= 70 ? T.amber : T.red;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</span>
          {subtitle && <span style={{ fontSize: 11, color: T.textMute, marginLeft: 8 }}>{subtitle}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.textSec, fontVariantNumeric: "tabular-nums" }}>
            {fmtNum(current)} / {fmtNum(target)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, fontVariantNumeric: "tabular-nums" }}>
            {pctValue.toFixed(0)}%
          </span>
        </div>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          width: `${pctBarWidth}%`, height: "100%",
          background: `linear-gradient(90deg, ${statusColor}, ${statusColor}cc)`,
          borderRadius: 3, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
    </div>
  );
}

// ─── DEAL AGE TABLE ─────────────────────────────────────────────

function dealAgeColor(days) {
  if (days <= 7)  return T.green;
  if (days <= 14) return T.amber;
  if (days <= 30) return T.amber;
  return T.red;
}

function DealAgeTable({ deals }) {
  return (
    <Section title="Pipeline · Deal Age">
      <div style={{
        display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr",
        gap: 8, fontSize: 11, color: T.textMute, marginBottom: 8,
        paddingBottom: 8, borderBottom: `1px solid rgba(255,255,255,0.06)`,
      }}>
        <div>Deal</div><div>Stage</div><div>Value</div><div>Deal Age</div>
      </div>
      {deals.map((d) => (
        <div key={d.deal_id} style={{
          display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr",
          gap: 8, fontSize: 12, padding: "6px 0", alignItems: "center", color: T.text,
        }}>
          <div>{d.deal_name}</div>
          <div style={{ color: T.textSec }}>{d.stage}</div>
          <div>{fmt(d.value)}</div>
          <div>
            <span style={{
              background: dealAgeColor(d.days_in_stage),
              color: d.days_in_stage > 30 ? "#fff" : "#000",
              padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
            }}>
              {d.days_in_stage} days
            </span>
          </div>
        </div>
      ))}
      {deals.length === 0 && (
        <div style={{ color: T.textMute, fontSize: 12, padding: "12px 0" }}>
          No active deals in pipeline
        </div>
      )}
    </Section>
  );
}

// ─── SIDEBAR NAV ────────────────────────────────────────────────

function Sidebar({ view, setView, reps, currentRepId, onRepChange }) {
  const items = [
    { key: "overview", label: "Overview", icon: "\u25A6" },
    { key: "pipeline", label: "Pipeline", icon: "\u25CE" },
    { key: "breakdown", label: "Breakdown", icon: "\u25C9" },
    { key: "distributors", label: "Distributors", icon: "\u2691" },
  ];

  return (
    <div style={{
      width: 56, minHeight: "100vh", background: T.surface,
      borderRight: `1px solid ${T.border}`, padding: "20px 0",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      position: "fixed", left: 0, top: 0, zIndex: 10,
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
      <div style={{ marginTop: "auto", paddingBottom: 12 }}>
        {reps.map((r) => (
          <button key={r.id} onClick={() => onRepChange(r.id)} title={r.name}
            style={{
              width: 40, height: 40, borderRadius: 8, border: "none",
              background: currentRepId === r.id ? T.accentGlow : "transparent",
              color: currentRepId === r.id ? T.accent : T.textMute,
              cursor: "pointer", fontSize: 11, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
            {r.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GOALS EDITOR MODAL ─────────────────────────────────────────

function GoalsEditor({ goals, onSave, onClose }) {
  const [r1, setR1] = useState(Number(goals?.q1_revenue) || 0);
  const [r2, setR2] = useState(Number(goals?.q2_revenue) || 0);
  const [r3, setR3] = useState(Number(goals?.q3_revenue) || 0);
  const [r4, setR4] = useState(Number(goals?.q4_revenue) || 0);
  const [d1, setD1] = useState(Number(goals?.q1_deals) || 0);
  const [d2, setD2] = useState(Number(goals?.q2_deals) || 0);
  const [d3, setD3] = useState(Number(goals?.q3_deals) || 0);
  const [d4, setD4] = useState(Number(goals?.q4_deals) || 0);

  const inputStyle = {
    width: "100%", padding: "8px 12px", fontSize: 14,
    background: T.surfaceAlt, border: `1px solid ${T.border}`,
    borderRadius: 6, color: T.text, outline: "none",
    fontVariantNumeric: "tabular-nums",
  };
  const sectionLabel = {
    fontSize: 11, fontWeight: 600, color: T.textMute,
    textTransform: "uppercase", letterSpacing: "0.06em",
    marginBottom: 10,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: 28, maxWidth: 460, width: "100%",
        boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: T.text, margin: 0 }}>
            {new Date().getFullYear()} Quarterly Goals
          </h2>
          <button onClick={onClose} style={{
            border: "none", background: T.surfaceAlt, width: 28, height: 28,
            borderRadius: 6, cursor: "pointer", color: T.textMute, fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>x</button>
        </div>

        <p style={sectionLabel}>Revenue ($)</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[["Q1", r1, setR1], ["Q2", r2, setR2], ["Q3", r3, setR3], ["Q4", r4, setR4]].map(([label, val, setter]) => (
            <div key={"rev-" + label}>
              <label style={{ fontSize: 11, fontWeight: 500, color: T.textMute, display: "block", marginBottom: 6 }}>{label}</label>
              <input type="number" value={val} onChange={e => setter(Number(e.target.value))} style={inputStyle} />
            </div>
          ))}
        </div>

        <p style={sectionLabel}>Deals (count)</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
          {[["Q1", d1, setD1], ["Q2", d2, setD2], ["Q3", d3, setD3], ["Q4", d4, setD4]].map(([label, val, setter]) => (
            <div key={"deals-" + label}>
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
          <button onClick={() => {
            onSave({
              q1_revenue: r1, q2_revenue: r2, q3_revenue: r3, q4_revenue: r4,
              q1_deals: d1, q2_deals: d2, q3_deals: d3, q4_deals: d4,
            });
            onClose();
          }} style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 600, borderRadius: 6,
            border: "none", background: T.accent, color: "#fff", cursor: "pointer",
          }}>Save Goals</button>
        </div>
      </div>
    </div>
  );
}

// ─── TODAY'S CALLS ──────────────────────────────────────────────

const REASON_LABELS = {
  reorder_due: "Reorder Due",
  pipeline_stalled: "Stalled",
  anniversary_window: "Anniversary",
  goal_gap_critical: "Goal Gap",
};
const REASON_COLORS = {
  reorder_due:        { bg: T.greenGlow,  fg: T.green  },
  pipeline_stalled:   { bg: T.amberGlow,  fg: T.amber  },
  anniversary_window: { bg: T.accentGlow, fg: T.accent },
  goal_gap_critical:  { bg: T.redGlow,    fg: T.red    },
};

function TodaysCalls({ repId }) {
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAPI(`/api/rep/${repId}/today`)
      .then((d) => { setResp(d); setLoading(false); })
      .catch(() => { setResp({ items: [], data_as_of: null, is_today: null }); setLoading(false); });
  }, [repId]);

  const items = resp?.items || [];
  const isToday = resp?.is_today;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 8,
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: T.textMute, margin: 0,
                    textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Today's Calls
        </p>
        {resp?.data_as_of && isToday && (
          <span style={{ fontSize: 10, color: T.textMute }}>
            Computed {resp.data_as_of}{items.length > 0 ? ` · ${items.length} picks` : ""}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: T.radius, padding: 16, color: T.textMute, fontSize: 12 }}>
          Loading today's calls...
        </div>
      )}

      {!loading && !isToday && items.length > 0 && (
        <div style={{
          background: T.amberGlow, border: `1px solid ${T.amber}`,
          borderRadius: T.radius, padding: "8px 12px", marginBottom: 8,
          fontSize: 11, color: T.amber,
        }}>
          Based on yesterday's data. Today's picks available after 6 AM CST.
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{
          background: T.surface, border: `1px dashed ${T.border}`,
          borderRadius: T.radius, padding: 24, textAlign: "center",
          color: T.textMute, fontSize: 12,
        }}>
          Light pipeline today. Focus on prospecting.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => {
            const palette = REASON_COLORS[it.reason_code] || { bg: T.surfaceAlt, fg: T.textMute };
            return (
              <div key={it.id || it.rank} style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: T.radius, padding: 14,
                display: "grid", gridTemplateColumns: "32px 1fr 140px",
                gap: 14, alignItems: "start",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0, width: 3,
                  background: palette.fg,
                }} />
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: T.surfaceAlt, border: `1px solid ${T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: T.textSec,
                }}>{it.rank}</div>

                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>
                      {it.customer_name}
                    </p>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      background: palette.bg, color: palette.fg,
                    }}>{REASON_LABELS[it.reason_code] || it.reason_code}</span>
                  </div>
                  <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 6px",
                              lineHeight: 1.4 }}>
                    {it.reason_text}
                  </p>
                  <p style={{
                    fontSize: 11, color: T.textMute, margin: 0,
                    fontStyle: "italic", borderLeft: `2px solid ${T.borderHov}`,
                    paddingLeft: 8,
                  }}>
                    {it.suggested_opening}
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  {it.expected_value > 0 && (
                    <>
                      <p style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>
                        {fmt(it.expected_value)}
                      </p>
                      <p style={{ fontSize: 9, color: T.textMute, margin: "2px 0 0",
                                  textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Expected
                      </p>
                    </>
                  )}
                  <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.06)",
                                borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.round((it.signal_strength || 0) * 100)}%`,
                      height: "100%", background: palette.fg,
                    }} />
                  </div>
                  <p style={{ fontSize: 9, color: T.textMute, margin: "3px 0 0" }}>
                    Signal {Number(it.signal_strength || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────

export default function App() {
  const [repId, setRepId] = useState(() => {
    const path = window.location.pathname.replace("/rep/", "");
    return ["kinga", "pete"].includes(path) ? path : "kinga";
  });
  const [view, setView] = useState("overview");
  const [reps, setReps] = useState([]);
  const [data, setData] = useState(null);
  const [extras, setExtras] = useState({});
  const [loading, setLoading] = useState(true);
  const [showGoals, setShowGoals] = useState(false);

  useEffect(() => {
    fetchAPI("/api/reps").then(setReps).catch(() => setReps([
      { id: "kinga", name: "Kinga" },
      { id: "pete", name: "Pete" },
    ]));
  }, []);

  const loadData = async (id) => {
    setLoading(true);
    setView("overview");
    window.history.replaceState(null, "", `/rep/${id}`);

    try {
      const [snapshot, goals, pipeline, distributors, history] = await Promise.all([
        fetchAPI(`/api/rep/${id}/snapshot`),
        fetchAPI(`/api/rep/${id}/goals`),
        fetchAPI(`/api/rep/${id}/pipeline`),
        fetchAPI(`/api/rep/${id}/distributors`),
        fetchAPI(`/api/rep/${id}/history`),
      ]);

      const ext = await (id === "kinga"
        ? Promise.all([
            fetchAPI(`/api/rep/kinga/sports`),
            fetchAPI(`/api/rep/kinga/products`),
          ]).then(([s, p]) => ({ sports: numify(s) || [], products: numify(p) || [] }))
        : Promise.all([
            fetchAPI(`/api/rep/pete/products`),
            fetchAPI(`/api/rep/pete/fallen-angels`),
          ]).then(([p, fa]) => ({ products: numify(p) || [], fallenAngels: numify(fa) || [] })));

      setData({
        snapshot: numify(snapshot) || {},
        goals: numify(goals) || {},
        pipeline: numify(pipeline) || [],
        distributors: numify(distributors) || [],
        history: numify(history) || [],
      });
      setExtras(ext);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(repId); }, [repId]);

  const saveGoals = async (goals) => {
    await fetch(`${API_URL}/api/rep/${repId}/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(goals),
    });
    loadData(repId);
  };

  if (loading || !data) return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: T.bg, color: T.textMute, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ fontSize: 14 }}>Loading dashboard...</div>
    </div>
  );

  const s = data.snapshot || {};
  const g = data.goals || {};
  const qNum = getQuarterNum();
  const qKey = getQuarterKey();
  const qGoal = Number(g[qKey]) || 0;
  const revQtd = Number(s.revenue_qtd) || 0;
  const qPct = qGoal > 0 ? (revQtd / qGoal) * 100 : 0;
  const onPace = qPct >= 70;
  const repName = repId === "kinga" ? "Kinga" : "Pete";
  const repSectors = reps.find(r => r.id === repId)?.sectors?.join(", ") || "";
  const historyRevenues = data.history.map(h => h.revenue_ytd || 0);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: T.bg, color: T.text, minHeight: "100vh",
      fontVariantNumeric: "tabular-nums",
    }}>
      {showGoals && (
        <GoalsEditor goals={g} onSave={saveGoals} onClose={() => setShowGoals(false)} />
      )}

      <Sidebar
        view={view} setView={setView}
        reps={reps} currentRepId={repId} onRepChange={setRepId}
      />

      <div style={{ marginLeft: 56, padding: "28px 36px", maxWidth: 1100 }}>

        {/* ─── TOP BAR ─────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
              {repName} <span style={{ color: T.textMute, fontWeight: 400 }}>{repSectors}</span>
            </h1>
            <p style={{ fontSize: 12, color: T.textMute, margin: "4px 0 0" }}>
              Last refreshed {s.snapshot_date
                ? new Date(s.snapshot_date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
                : "N/A"} at 6:15 AM CST
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

        {/* ─── HERO: QTD GOAL PROGRESS ───────────────────────── */}
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
                Q{qNum} Revenue vs. Quarterly Goal
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: T.text, lineHeight: 1 }}>
                  <AnimatedValue value={s.revenue_qtd || 0} formatter={(v) => fmt(Math.round(v))} />
                </span>
                <span style={{ fontSize: 16, color: T.textMute }}>/ {fmt(qGoal)}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{
                fontSize: 28, fontWeight: 700,
                color: onPace ? T.green : T.amber,
              }}>{qGoal > 0 ? qPct.toFixed(1) : "0.0"}%</span>
              <p style={{ fontSize: 11, color: T.textMute, margin: "4px 0 0" }}>
                {qGoal > 0 ? (onPace ? "On pace" : "Behind pace") : "No goal set"}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${Math.min(qPct, 100)}%`, height: "100%",
                background: onPace
                  ? `linear-gradient(90deg, ${T.green}, ${T.accent})`
                  : `linear-gradient(90deg, ${T.amber}, ${T.red})`,
                borderRadius: 4,
                transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>
          </div>
        </div>

        {/* ─── TODAY'S CALLS ────────────────────────────────── */}
        <TodaysCalls repId={repId} />

        {/* ─── OVERVIEW VIEW ───────────────────────────────── */}
        {view === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 14 }}>
              <MetricCard label="WTD Revenue" value={s.revenue_wtd || 0} trend={s.wow_pct ? Number(s.wow_pct) : null} trendLabel="WoW" highlight />
              <MetricCard label="MTD Revenue" value={s.revenue_mtd || 0} trend={s.mom_pct ? Number(s.mom_pct) : null} trendLabel="MoM" />
              <MetricCard label="QTD Revenue" value={s.revenue_qtd || 0} sparkData={historyRevenues.length > 1 ? historyRevenues : null} sparkColor={T.green} trendLabel={qGoal > 0 ? `${Math.round(qPct)}% of Q${qNum} goal` : null} />
              <MetricCard label="YTD Revenue" value={s.revenue_ytd || 0} trend={s.yoy_pct ? Number(s.yoy_pct) : null} trendLabel="YoY" />
              <MetricCard label="Avg Deal Size" value={s.avg_order_size || 0} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Section title="Performance Metrics">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  {[
                    ["Deals Closed MTD", s.deals_closed_mtd || 0],
                    ["Deals Closed YTD", s.deals_closed_ytd || 0],
                    ["Sales Velocity", `${s.sales_velocity_days || 0}d`],
                  ].map(([label, val]) => (
                    <div key={label} style={{
                      background: T.surfaceAlt, borderRadius: 8, padding: "14px 12px", textAlign: "center",
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 500, color: T.textMute, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                      <p style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 0", color: T.text }}>{val}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Revenue Trend (30 Days)">
                <AreaChart
                  data={historyRevenues.length > 1 ? historyRevenues : [0, 0]}
                  width={460} height={120} color={T.accent} id="rev"
                />
              </Section>
            </div>

            <DealAgeTable deals={data.pipeline.slice(0, 5)} />

            <Section title="Quarterly Goal Progress">
              <GoalProgressBar label={`Q${qNum} Revenue`} current={s.revenue_qtd || 0} target={qGoal} />
              <GoalProgressBar label={`Q${qNum} Deals`} current={s.deals_closed_mtd || 0} target={g[`q${qNum}_deals`] || 0} isCurrency={false} />
            </Section>
          </>
        )}

        {/* ─── PIPELINE VIEW ───────────────────────────────── */}
        {view === "pipeline" && <DealAgeTable deals={data.pipeline} />}

        {/* ─── BREAKDOWN VIEW ──────────────────────────────── */}
        {view === "breakdown" && (
          <>
            {repId === "kinga" && extras.sports && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
                {extras.sports.map((sp) => (
                  <div key={sp.level} style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: T.radius, padding: "18px 16px",
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3,
                      background: SECTOR_ACCENT["Athletics"],
                    }} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0 }}>{sp.level}</p>
                    <p style={{ fontSize: 24, fontWeight: 700, margin: "10px 0 4px" }}>{fmt(sp.revenue_ytd)}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.textMute }}>YTD Revenue</span>
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                      marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`,
                    }}>
                      <div>
                        <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>Deals</p>
                        <p style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 0" }}>{sp.deals_ytd}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>YoY</p>
                        <p style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 0", color: (sp.yoy_growth || 0) >= 0 ? T.green : T.red }}>
                          {fmtPct(sp.yoy_growth)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {repId === "kinga" && extras.products && extras.products.length > 0 && (
              <Section title="Product Intelligence (YTD)">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {extras.products.map((p) => (
                    <div key={p.product_line} style={{
                      background: T.surfaceAlt, borderRadius: 8, padding: "14px 12px", textAlign: "center",
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 500, color: T.textMute, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.product_line}</p>
                      <p style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 2px", color: T.text }}>{p.units_sold_ytd} units</p>
                      <p style={{ fontSize: 12, color: T.textSec }}>{fmt(p.revenue_ytd)}</p>
                      <p style={{ fontSize: 11, color: (p.yoy_growth || 0) >= 0 ? T.green : T.red, marginTop: 4 }}>
                        {fmtPct(p.yoy_growth)} YoY
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {repId === "pete" && (
              <>
                <Section title="Sector Breakdown">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                    {(() => {
                      const sectors = {};
                      (data.distributors || []).forEach((d) => {
                        const sec = d.sector || "Other";
                        if (!sectors[sec]) sectors[sec] = { revenue_ytd: 0, revenue_qtd: 0, deals: 0 };
                        sectors[sec].revenue_ytd += Number(d.revenue_ytd) || 0;
                        sectors[sec].revenue_qtd += Number(d.revenue_qtd) || 0;
                        sectors[sec].deals += Number(d.deals_ytd) || 0;
                      });
                      return Object.entries(sectors).map(([name, vals]) => (
                        <div key={name} style={{
                          background: T.surfaceAlt, borderRadius: T.radius, padding: "18px 16px",
                          position: "relative", overflow: "hidden",
                        }}>
                          <div style={{
                            position: "absolute", top: 0, left: 0, right: 0, height: 3,
                            background: SECTOR_ACCENT[name] || T.accent,
                          }} />
                          <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{name}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                            <div>
                              <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>YTD</p>
                              <p style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 0" }}>{fmt(vals.revenue_ytd)}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>QTD</p>
                              <p style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 0" }}>{fmt(vals.revenue_qtd)}</p>
                            </div>
                          </div>
                          <p style={{ fontSize: 11, color: T.textMute, marginTop: 8 }}>{vals.deals} deals YTD</p>
                        </div>
                      ));
                    })()}
                  </div>
                </Section>

                {extras.products && extras.products.length > 0 && (
                  <Section title="Product Intelligence (YTD)">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      {extras.products.map((p) => (
                        <div key={p.product_line} style={{
                          background: T.surfaceAlt, borderRadius: 8, padding: "14px 12px", textAlign: "center",
                        }}>
                          <p style={{ fontSize: 10, fontWeight: 500, color: T.textMute, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.product_line}</p>
                          <p style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 2px", color: T.text }}>{p.units_sold_ytd} units</p>
                          <p style={{ fontSize: 12, color: T.textSec }}>{fmt(p.revenue_ytd)}</p>
                          <p style={{ fontSize: 11, color: (p.yoy_growth || 0) >= 0 ? T.green : T.red, marginTop: 4 }}>
                            {fmtPct(p.yoy_growth)} YoY
                          </p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {extras.fallenAngels && extras.fallenAngels.length > 0 && (
                  <Section title="Fallen Angels · 90+ Days No Purchase">
                    <div style={{
                      display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
                      gap: 8, fontSize: 11, color: T.textMute, marginBottom: 8,
                      paddingBottom: 8, borderBottom: `1px solid rgba(255,255,255,0.06)`,
                    }}>
                      <div>Customer</div><div>Last Purchase</div><div>Days Inactive</div><div>Lifetime Revenue</div>
                    </div>
                    {extras.fallenAngels.map((fa) => (
                      <div key={fa.customer_name} style={{
                        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
                        gap: 8, fontSize: 12, padding: "6px 0", alignItems: "center", color: T.text,
                      }}>
                        <div>{fa.customer_name}</div>
                        <div style={{ color: T.textMute }}>{fa.last_purchase_date ? new Date(fa.last_purchase_date).toLocaleDateString() : ""}</div>
                        <div>
                          <span style={{
                            background: T.red, color: "#fff",
                            padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
                          }}>
                            {fa.days_inactive} days
                          </span>
                        </div>
                        <div>{fmt(fa.lifetime_revenue)}</div>
                      </div>
                    ))}
                  </Section>
                )}
              </>
            )}
          </>
        )}

        {/* ─── DISTRIBUTORS VIEW ─────────────────────────────── */}
        {view === "distributors" && (
          <>
          <p style={{ fontSize: 11, fontWeight: 600, color: T.textMute, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Top Customers by YTD Revenue
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
            {data.distributors.map((d) => {
              const accent = SECTOR_ACCENT[d.sector] || T.accent;
              return (
                <div key={d.distributor_name} style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: T.radius, padding: "18px 16px",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 3,
                    background: accent,
                  }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{d.distributor_name}</p>
                  <p style={{ fontSize: 11, color: T.textMute, marginBottom: 10 }}>{d.industry || "Unclassified"}</p>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>YTD</p>
                      <p style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 0" }}>{fmt(d.revenue_ytd)}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 10, color: T.textMute, margin: 0, textTransform: "uppercase" }}>QTD</p>
                      <p style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 0" }}>{fmt(d.revenue_qtd)}</p>
                    </div>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}`,
                  }}>
                    <span style={{ fontSize: 11, color: T.textMute }}>{d.deals_ytd} deals</span>
                    <TrendBadge value={d.mom_growth || 0} label="MoM" />
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
          MX3 Diagnostics Sales Dashboard
        </div>
      </div>
    </div>
  );
}
