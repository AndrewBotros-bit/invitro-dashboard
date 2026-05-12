/**
 * InVitro Capital brand logo.
 *
 * Two right-pointing chevrons: a light-blue one behind (smaller, offset
 * down-left) and a dark-navy one in front (larger, offset up-right).
 *
 * This is an inline-SVG approximation of the official artwork. To swap in
 * the exact artwork, save the official file at `public/logo-icon.svg` and
 * replace this component with `<img src="/logo-icon.svg" />`.
 *
 * Variants:
 *   - "icon"  : just the chevrons (square aspect, default)
 *   - "full"  : chevrons + wordmark stacked horizontally
 */

const BRAND_NAVY = '#0A2540';
const BRAND_SKY  = '#8AB8E8';

export function Logo({ size = 36, variant = 'icon', className = '' }) {
  if (variant === 'full') {
    // Horizontal lockup: icon + wordmark
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <LogoIcon size={size} />
        <span className="flex flex-col leading-none">
          <span className="font-extrabold tracking-tight" style={{ color: BRAND_NAVY, fontSize: size * 0.55 }}>
            InVitro
          </span>
          <span className="font-bold tracking-wide" style={{ color: BRAND_SKY, fontSize: size * 0.30, marginTop: 1 }}>
            Capital
          </span>
        </span>
      </div>
    );
  }
  return <LogoIcon size={size} className={className} />;
}

function LogoIcon({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="InVitro Capital"
    >
      {/* Light blue chevron — smaller, sits back-left */}
      <path
        d="M 18 32 L 38 50 L 18 68"
        stroke={BRAND_SKY}
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Dark navy chevron — larger, sits front-right */}
      <path
        d="M 50 22 L 78 50 L 50 78"
        stroke={BRAND_NAVY}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Exported for use elsewhere (e.g. setting brand colors on charts).
export const BRAND_COLORS = { navy: BRAND_NAVY, sky: BRAND_SKY };
