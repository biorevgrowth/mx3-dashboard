import { T } from "../theme.js";

export default function GoalProgress({ label, current, goal }) {
  const pct = goal > 0 ? Math.round((current / goal) * 100) : 0;
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: 12,
    }}>
      <div style={{ fontSize: 11, color: T.textMute }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, margin: "4px 0", color: T.text }}>{pct}%</div>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: T.accent, borderRadius: 2 }} />
      </div>
    </div>
  );
}
