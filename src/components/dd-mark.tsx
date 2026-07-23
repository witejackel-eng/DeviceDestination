type DDMarkProps = {
  tone?: "brand" | "dark" | "light";
  className?: string;
};

export function DDMark({ tone = "brand", className }: DDMarkProps) {
  /* Geometric DD monogram — refined for optical clarity:
     - Two opposing D-shaped outlines with wider, more open forms
     - Larger central circular aperture (orange on all tones)
     - Wider stroke weight for better small-size legibility
     - Increased curvature radius so each D reads clearly
     - The central aperture is unmistakably a circle, not a narrow gap
     - At 16px and 24px the mark reads as two connected D forms */

  const strokeColor = tone === "light" ? "#FFFFFF" : "#111214";
  const apertureFill = "#FF6A00"; // Orange accent always visible on the aperture

  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="DeviceDestination"
      fill="none"
    >
      {/* Left D outline — opens toward center, wider form */}
      <path
        d="M7 7 L7 33"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M7 7 C19 7, 22 14, 22 20 C22 26, 19 33, 7 33"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right D outline — opens toward center, mirrored */}
      <path
        d="M33 7 L33 33"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M33 7 C21 7, 18 14, 18 20 C18 26, 21 33, 33 33"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central circular aperture — larger for unmistakable connection point */}
      <circle cx="20" cy="20" r="4.5" fill={apertureFill} />

      {/* Dot accents at D corners — suggesting hardware port pins */}
      <circle cx="7" cy="7" r="1.2" fill={strokeColor} opacity="0.35" />
      <circle cx="7" cy="33" r="1.2" fill={strokeColor} opacity="0.35" />
      <circle cx="33" cy="7" r="1.2" fill={strokeColor} opacity="0.35" />
      <circle cx="33" cy="33" r="1.2" fill={strokeColor} opacity="0.35" />
    </svg>
  );
}
