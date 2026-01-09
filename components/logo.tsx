interface LogoProps {
  className?: string
}

export function Logo({ className = "h-10 w-10" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-label="Giga Mangosteen logo" role="img">
      {/* Mangosteen fruit shape */}
      <circle cx="50" cy="50" r="40" fill="#ff6b35" />
      <circle cx="50" cy="50" r="32" fill="#0a0a0a" />
      {/* Crown/calyx on top */}
      <path
        d="M35 25 L50 10 L65 25"
        stroke="#ff6b35"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 30 L50 5 L70 30"
        stroke="#ff6b35"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner fruit segments */}
      <circle cx="40" cy="55" r="8" fill="#fafafa" opacity="0.9" />
      <circle cx="60" cy="55" r="8" fill="#fafafa" opacity="0.9" />
      <circle cx="50" cy="65" r="7" fill="#fafafa" opacity="0.9" />
    </svg>
  )
}
