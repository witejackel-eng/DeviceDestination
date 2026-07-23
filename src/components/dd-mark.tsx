type DDMarkProps = {
  tone?: "brand" | "dark" | "light";
  className?: string;
};

export function DDMark({ tone = "brand", className }: DDMarkProps) {
  /* Geometric DD monogram:
     - Two opposing D-shaped outlines
     - A small central circular aperture (orange on all tones)
     - Negative space subtly suggests camera lens, hardware port, connected devices, and the initials DD
     - No gradients, no excessive detail, no cartoon styling */

  const strokeColor = tone === "light" ? "#FFFFFF" : tone === "brand" ? "#111214" : "#111214";
  const apertureFill = "#FF6A00"; // Orange accent always visible on the aperture

  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="DeviceDestination"
      fill="none"
    >
      {/* Left D outline — opens toward center */}
      <path
        d="M7 7 L7 33 C7 33 7 33 7 33"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M7 7 C18 7, 20 13, 20 20 C20 27, 18 33, 7 33"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right D outline — opens toward center, mirrored */}
      <path
        d="M33 7 L33 33"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M33 7 C22 7, 20 13, 20 20 C20 27, 22 33, 33 33"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central circular aperture — orange accent point */}
      <circle cx="20" cy="20" r="3" fill={apertureFill} />

      {/* Tiny dot accents at D corners — suggesting hardware port pins */}
      <circle cx="7" cy="7" r="1" fill={strokeColor} opacity="0.4" />
      <circle cx="7" cy="33" r="1" fill={strokeColor} opacity="0.4" />
      <circle cx="33" cy="7" r="1" fill={strokeColor} opacity="0.4" />
      <circle cx="33" cy="33" r="1" fill={strokeColor} opacity="0.4" />
    </svg>
  );
}
