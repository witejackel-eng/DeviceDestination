type DDMarkProps = {
  tone?: "brand" | "dark" | "light";
  className?: string;
};

export function DDMark({ tone = "brand", className }: DDMarkProps) {
  const monochrome = tone !== "brand";
  const leftFill = monochrome ? "currentColor" : "var(--ink)";
  const rightFill = monochrome ? "currentColor" : "var(--tangerine)";
  const arrowFill = monochrome ? "currentColor" : "var(--tangerine)";
  const lensStroke = monochrome ? "currentColor" : "var(--canvas)";
  const irisFill = monochrome ? "currentColor" : "var(--ink)";
  const nodeFill = monochrome ? "currentColor" : "var(--ink)";

  return (
    <svg
      data-anime-brand-mark
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="DeviceDestination"
    >
      <path
        data-dd-part="d-left"
        d="M9,8 L9,32 A12,12 0 0 1 9,8 Z"
        fill={leftFill}
      />
      <path
        data-dd-part="d-right"
        d="M31,8 L31,32 A12,12 0 0 0 31,8 Z"
        fill={rightFill}
      />
      <path data-dd-part="d-right" d="M31,15 L37,20 L31,25 Z" fill={arrowFill} />
      <circle
        data-dd-part="lens"
        cx="20"
        cy="20"
        r="6"
        fill="none"
        stroke={lensStroke}
        strokeWidth="1.6"
      />
      <circle data-dd-part="lens" cx="20" cy="20" r="2.2" fill={irisFill} />
      <circle data-dd-part="node" cx="9" cy="8" r="1.6" fill={nodeFill} opacity="0.55" />
      <circle data-dd-part="node" cx="9" cy="32" r="1.6" fill={nodeFill} opacity="0.55" />
      <circle data-dd-part="node" cx="31" cy="8" r="1.6" fill={nodeFill} opacity="0.55" />
      <circle data-dd-part="node" cx="31" cy="32" r="1.6" fill={nodeFill} opacity="0.55" />
    </svg>
  );
}
