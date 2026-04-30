import { T, fmt, fmtPct } from "../theme.js";

export default function DistributorCard({ name, sector, revenueYtd, revenueQtd, deals, momGrowth }) {
  const trendColor = momGrowth > 0 ? T.green : momGrowth < 0 ? T.red : T.textMute;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{name}</div>
      <div style={{ fontSize: 10, color: T.textMute, marginBottom: 8 }}>{sector}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 10, color: T.textMute }}>YTD</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{fmt(revenueYtd)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: T.textMute }}>QTD</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{fmt(revenueQtd)}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.textMute }}>{deals} deals</div>
      <div style={{ fontSize: 11, color: trendColor }}>{fmtPct(momGrowth)} MoM</div>
    </div>
  );
}
