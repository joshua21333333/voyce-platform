// Voyce nib mark — diamond body, centre breathing hole, slit, ink drop
// Matches the favicon/logo on usevoyce.lovable.app

interface VoyceLogoProps {
  size?: number
  color?: string
  className?: string
}

export function VoyceNib({ size = 24, color = 'currentColor', className }: VoyceLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Diamond nib body */}
      <path
        d="M12 1L22 10L12 23L2 10Z"
        fill={color}
        fillOpacity="0.95"
      />
      {/* Vertical slit — cuts from breathing hole to tip */}
      <line x1="12" y1="13" x2="12" y2="21" stroke="#0d0e12" strokeWidth="1.4" strokeLinecap="round" />
      {/* Centre breathing hole */}
      <circle cx="12" cy="11" r="2" fill="#0d0e12" />
    </svg>
  )
}

export function VoyceWordmark({ size = 20 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
      <VoyceNib size={size} color="#4b9eff" />
      <span
        style={{
          fontSize: `${size}px`,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: '#f0f2f8',
        }}
      >
        Voyce
      </span>
    </div>
  )
}
