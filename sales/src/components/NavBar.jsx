import { T } from "../theme.js";

export default function NavBar({ repName, tabs, activeTab, onTabChange, reps, onRepChange, currentRepId }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 20, paddingBottom: 12,
      borderBottom: `1px solid rgba(255,255,255,0.1)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          background: T.accent, color: "#fff", fontWeight: 700,
          fontSize: 14, padding: "6px 10px", borderRadius: 4,
        }}>MX3</div>
        <select
          value={currentRepId}
          onChange={(e) => onRepChange(e.target.value)}
          style={{
            background: T.surface, color: T.text, border: `1px solid ${T.border}`,
            borderRadius: 4, padding: "4px 8px", fontSize: 16, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {reps.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 13, color: T.textMute }}>
        {tabs.map((tab) => (
          <span
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              cursor: "pointer",
              color: activeTab === tab ? T.accent : T.textMute,
              borderBottom: activeTab === tab ? `2px solid ${T.accent}` : "2px solid transparent",
              paddingBottom: 4,
            }}
          >
            {tab}
          </span>
        ))}
      </div>
    </div>
  );
}
