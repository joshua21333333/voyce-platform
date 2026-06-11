// Voyce nib mark — recreated from the official android-chrome-512x512.png
//
// Structure (from the actual logo):
//   • White diamond body (rotated square)
//   • Dark vertical line through full height of diamond
//   • Solid black filled circle (nib breathing hole) — upper half of line
//   • White oval ink drop at the bottom tip of the line, below the diamond vertex
//   • Two grey diagonal lines diverging from the ink drop outward (nib tines)

interface VoyceLogoProps {
  size?: number
  // 'dark' = white diamond on dark bg (nav/dark pages)
  // 'light' = dark diamond on light bg (emails etc)
  variant?: 'dark' | 'light'
  className?: string
}

export function VoyceNib({ size = 24, variant = 'dark', className }: VoyceLogoProps) {
  const diamond = variant === 'dark' ? '#ffffff' : '#111111'
  const line    = variant === 'dark' ? '#0d0e12' : '#ffffff'
  const dot     = variant === 'dark' ? '#0d0e12' : '#ffffff'
  const drop    = variant === 'dark' ? '#ffffff' : '#111111'
  const tines   = variant === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'

  // Viewport: 48×52 (slightly taller to accommodate ink drop below vertex)
  return (
    <svg
      width={size}
      height={Math.round(size * 52 / 48)}
      viewBox="0 0 48 52"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Diamond body */}
      <path d="M24 3 L45 24 L24 45 L3 24 Z" fill={diamond} />

      {/* Vertical slit through diamond */}
      <line
        x1="24" y1="5"
        x2="24" y2="43"
        stroke={line}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Breathing hole — filled circle, upper-centre of diamond */}
      <circle cx="24" cy="21" r="5" fill={dot} />

      {/* Ink drop — white oval just below the diamond's bottom vertex */}
      <ellipse cx="24" cy="48" rx="3" ry="4" fill={drop} />

      {/* Nib tines — two grey lines from ink drop spreading upward-outward */}
      <line
        x1="24" y1="45"
        x2="10" y2="36"
        stroke={tines}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="24" y1="45"
        x2="38" y2="36"
        stroke={tines}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Full wordmark: nib + "Voyce" text
export function VoyceWordmark({ size = 20, variant = 'dark' as 'dark' | 'light' }) {
  const textColor = variant === 'dark' ? '#f0f2f8' : '#111111'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
      <VoyceNib size={size} variant={variant} />
      <span style={{ fontSize: `${size}px`, fontWeight: 600, letterSpacing: '0.04em', color: textColor, lineHeight: 1 }}>
        Voyce
      </span>
    </span>
  )
}

// PNG version — use where high resolution matters (og:image, larger displays)
export function VoyceLogoPng({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/voyce-logo.png"
      alt="Voyce"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: Math.round(size * 0.22) }}
    />
  )
}
