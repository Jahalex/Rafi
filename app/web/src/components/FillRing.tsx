/**
 * FillRing — Rafi's signature visual element
 *
 * An SVG arc ring around the token icon that shows fill percentage.
 * Color shifts: green → amber at 80% → red at 95% (urgent)
 * Pulses subtly when > 90% filled.
 */

interface FillRingProps {
  percent: number;       // 0–100
  size?: number;         // diameter in px, default 72
  strokeWidth?: number;  // arc stroke thickness, default 5
  urgent?: boolean;      // forces red + fast pulse
  children?: React.ReactNode; // center content (token icon)
}

export default function FillRing({
  percent,
  size = 72,
  strokeWidth = 5,
  urgent = false,
  children,
}: FillRingProps) {
  const clampedPct = Math.min(Math.max(percent, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedPct / 100);

  // Color logic — shifts from brand green to amber to red
  const trackColor = "rgba(0,0,0,0.06)";
  const arcColor =
    urgent || clampedPct >= 95
      ? "#ef4444"         // red — urgent
      : clampedPct >= 80
      ? "#f59e0b"         // amber — almost full
      : "#278664";        // rafi green

  const shouldPulse = clampedPct >= 90 || urgent;

  return (
    <div
      className={`fill-ring-wrap ${shouldPulse ? "fill-ring-pulse" : ""}`}
      style={{ width: size, height: size, position: "relative", flexShrink: 0 }}
    >
      {/* SVG Arc */}
      <svg
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Track (background circle) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Arc (fill indicator) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.3s" }}
        />
      </svg>

      {/* Center content (token icon) */}
      <div
        style={{
          position: "absolute",
          inset: strokeWidth + 2,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "var(--bg-card)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
