import { T, fmt, dealAgeColor, dealAgeTextColor } from "../theme.js";
import SectionHeader from "./SectionHeader.jsx";

export default function DealAgeTable({ deals }) {
  return (
    <div>
      <SectionHeader>Pipeline — Deal Age</SectionHeader>
      <div style={{
        background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
        borderRadius: T.radius, padding: 16,
      }}>
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
            <div>{d.stage}</div>
            <div>{fmt(d.value)}</div>
            <div>
              <span style={{
                background: dealAgeColor(d.days_in_stage),
                color: dealAgeTextColor(d.days_in_stage),
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
      </div>
    </div>
  );
}
