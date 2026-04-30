import { T } from "../theme.js";

export default function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 11, textTransform: "uppercase", letterSpacing: 1,
      color: T.textMute, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}
