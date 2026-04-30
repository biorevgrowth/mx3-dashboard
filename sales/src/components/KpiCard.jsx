import { T, fmt, fmtPct } from "../theme.js";

export default function KpiCard({ label, value, trend, trendLabel, isCurrency = true }) {
  const trendColor = trend > 0 ? T.green : trend < 0 ? T.red : T.textMute;
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: 12,
    }}>
      <div style={{ fontSize: 11, color: T.textMute }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, margin: "4px 0", color: T.text }}>
        {isCurrency ? fmt(value) : value}
      </div>
      <div style={{ fontSize: 11, color: trendColor }}>
        {trend != null ? fmtPct(trend) : ""} {trendLabel || ""}
      </div>
    </div>
  );
}
