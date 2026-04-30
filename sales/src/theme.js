// MX3 Sales Dashboard — Design tokens
// Matched to executive dashboard: Investor-grade dark theme (Stripe/Linear/Vercel)
// Rule: max 6 colors. Color is signal, never decoration.
export const T = {
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
  font:       "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  navBg:      "#131318",
};

// Deal age color bands
export function dealAgeColor(days) {
  if (days <= 7)  return T.green;
  if (days <= 14) return T.amber;
  if (days <= 30) return T.amber;
  return T.red;
}

// Deal age text color
export function dealAgeTextColor(days) {
  return days > 30 ? "#fff" : "#000";
}

// Format currency
export function fmt(n) {
  if (n == null) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Format percentage with sign
export function fmtPct(n) {
  if (n == null) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Number(n).toFixed(1)}%`;
}
