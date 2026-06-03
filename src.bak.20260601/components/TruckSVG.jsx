// Vehicle side-profile illustrations
// Van: Toyota HiAce panel van — NO cargo windows, cab-only windows
// Small Truck: Isuzu 4.5T cab-over — distinct cab + cargo box
// Large Truck: Hino 8T cab-over — bigger box, dual rear axles

const TEAL = '#0d9488'
const TEAL_LIGHT = '#ccfbf1'

function Wheel({ cx, cy, r = 16, dual = false }) {
  const inner = r * 0.62
  const hub   = r * 0.3
  const spoke = r * 0.44
  return (
    <g>
      {/* Tyre */}
      <circle cx={cx} cy={cy} r={r} fill="#1e293b" />
      {/* Rim */}
      <circle cx={cx} cy={cy} r={inner} fill="#475569" />
      {/* Hub */}
      <circle cx={cx} cy={cy} r={hub} fill="#64748b" />
      {/* Spokes */}
      {[0, 60, 120, 180, 240, 300].map(a => {
        const rad = a * Math.PI / 180
        const x1 = cx + hub * Math.cos(rad), y1 = cy + hub * Math.sin(rad)
        const x2 = cx + spoke * Math.cos(rad), y2 = cy + spoke * Math.sin(rad)
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="2" />
      })}
      {/* Hub bolt ring */}
      {[0, 72, 144, 216, 288].map(a => {
        const rad = a * Math.PI / 180
        const bx = cx + spoke * 0.75 * Math.cos(rad), by = cy + spoke * 0.75 * Math.sin(rad)
        return <circle key={a} cx={bx} cy={by} r="1.8" fill="#94a3b8" />
      })}
      {dual && (
        <g>
          <circle cx={cx + r * 1.35} cy={cy} r={r * 0.9} fill="#1e293b" />
          <circle cx={cx + r * 1.35} cy={cy} r={r * 0.55} fill="#475569" />
          <circle cx={cx + r * 1.35} cy={cy} r={r * 0.26} fill="#64748b" />
        </g>
      )}
    </g>
  )
}

// ── Toyota HiAce LWB Panel Van ─────────────────────────────────────────────
export function VanSVG({ className = 'w-full' }) {
  return (
    <svg viewBox="0 0 300 118" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Shadow */}
      <ellipse cx="148" cy="113" rx="130" ry="5" fill="rgba(0,0,0,0.07)" />

      {/* ── BODY ── */}
      {/* Main body — boxy panel van */}
      <rect x="6" y="22" width="278" height="70" rx="5" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Roof */}
      <path d="M28 22 Q28 10 44 10 L268 10 Q280 10 280 22" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Teal brand stripe */}
      <rect x="6" y="60" width="278" height="12" fill={TEAL} opacity="0.12" />
      <rect x="6" y="60" width="278" height="2" fill={TEAL} opacity="0.5" />
      <rect x="6" y="70" width="278" height="2" fill={TEAL} opacity="0.5" />

      {/* ── FRONT CAB ── */}
      {/* Windshield */}
      <path d="M30 22 L30 56 L72 56 L72 22" fill="#dbeafe" fillOpacity="0.7" stroke="#93c5fd" strokeWidth="1" />
      {/* A-pillar */}
      <line x1="30" y1="10" x2="30" y2="56" stroke="#cbd5e1" strokeWidth="2" />

      {/* Side cab window */}
      <rect x="74" y="24" width="28" height="28" rx="3" fill="#dbeafe" fillOpacity="0.6" stroke="#93c5fd" strokeWidth="1" />
      {/* B-pillar */}
      <line x1="72" y1="10" x2="72" y2="92" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Front face */}
      <rect x="6" y="22" width="26" height="70" rx="5" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Headlight */}
      <rect x="8" y="28" width="18" height="9" rx="4" fill="#fef9c3" stroke="#fde047" strokeWidth="1" />
      {/* DRL */}
      <rect x="8" y="24" width="18" height="5" rx="2.5" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="0.8" />
      {/* Bumper */}
      <rect x="6" y="80" width="26" height="12" rx="3" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
      {/* Grille slots */}
      {[10, 16, 22].map(x => <line key={x} x1={x} y1="80" x2={x} y2="92" stroke="#cbd5e1" strokeWidth="0.8" />)}
      {/* Mirror */}
      <path d="M4 46 L2 46 L2 54 L4 54 L8 52 L8 48 Z" fill="#dde3ea" stroke="#cbd5e1" strokeWidth="0.8" />

      {/* ── CARGO AREA (no windows — panel van) ── */}
      {/* Sliding door outline */}
      <line x1="106" y1="22" x2="106" y2="92" stroke="#e2e8f0" strokeWidth="1.2" />
      <line x1="200" y1="22" x2="200" y2="92" stroke="#e2e8f0" strokeWidth="1.2" />
      {/* Sliding door handle */}
      <rect x="148" y="64" width="22" height="5" rx="2.5" fill="#cbd5e1" />
      <rect x="158" y="62" width="4" height="9" rx="2" fill="#94a3b8" />

      {/* Brand text on cargo */}
      <text x="153" y="47" textAnchor="middle" fontSize="9" fontFamily="'PingFang SC',Arial,sans-serif"
        fontWeight="800" fill={TEAL} opacity="0.7">迁喜搬家</text>
      <text x="153" y="58" textAnchor="middle" fontSize="6.5" fontFamily="Arial,sans-serif"
        fontWeight="600" fill="#94a3b8" letterSpacing="1">MOVE WITH EASE</text>

      {/* Rear lights */}
      <rect x="276" y="26" width="7" height="16" rx="3" fill="#fca5a5" stroke="#f87171" strokeWidth="1" />
      <rect x="276" y="48" width="7" height="8" rx="2" fill="#fed7aa" stroke="#fb923c" strokeWidth="0.8" />

      {/* Rear step */}
      <rect x="268" y="88" width="18" height="4" rx="2" fill="#e2e8f0" />

      {/* Undercarriage */}
      <rect x="6" y="89" width="278" height="4" rx="2" fill="#e2e8f0" />

      {/* ── WHEELS ── */}
      <Wheel cx={62} cy={103} r={15} />
      <Wheel cx={220} cy={103} r={15} />
    </svg>
  )
}

// ── Isuzu NPR 4.5T Small Truck ────────────────────────────────────────────
export function SmallTruckSVG({ className = 'w-full' }) {
  return (
    <svg viewBox="0 0 350 118" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <ellipse cx="172" cy="113" rx="158" ry="5" fill="rgba(0,0,0,0.07)" />

      {/* ── CARGO BOX ── */}
      <rect x="86" y="20" width="246" height="72" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Roof rail */}
      <rect x="86" y="18" width="246" height="4" rx="2" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />

      {/* Teal accent stripe on cargo */}
      <rect x="86" y="60" width="246" height="12" fill={TEAL} opacity="0.1" />
      <rect x="86" y="60" width="246" height="2.5" fill={TEAL} opacity="0.45" />
      <rect x="86" y="69.5" width="246" height="2.5" fill={TEAL} opacity="0.45" />

      {/* Rear door */}
      <rect x="308" y="20" width="24" height="72" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
      <line x1="308" y1="20" x2="308" y2="92" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Door handle */}
      <rect x="318" y="53" width="10" height="5" rx="2.5" fill="#cbd5e1" />
      {/* Tail lift */}
      <rect x="330" y="84" width="6" height="10" rx="2" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
      {/* Rear lights */}
      <rect x="316" y="25" width="8" height="16" rx="3" fill="#fca5a5" stroke="#f87171" strokeWidth="1" />
      <rect x="316" y="47" width="8" height="9" rx="2" fill="#fed7aa" stroke="#fb923c" strokeWidth="0.8" />

      {/* Cargo text */}
      <text x="195" y="46" textAnchor="middle" fontSize="9" fontFamily="'PingFang SC',Arial,sans-serif"
        fontWeight="800" fill={TEAL} opacity="0.65">迁喜搬家</text>
      <text x="195" y="56" textAnchor="middle" fontSize="6.5" fontFamily="Arial,sans-serif"
        fontWeight="600" fill="#94a3b8" letterSpacing="1">MOVE WITH EASE</text>
      {/* Volume badge */}
      <text x="195" y="85" textAnchor="middle" fontSize="8" fontFamily="Arial,sans-serif"
        fontWeight="700" fill={TEAL} opacity="0.5">20 m³</text>

      {/* ── CAB (cab-over, flat front) ── */}
      {/* Cab body */}
      <rect x="8" y="28" width="80" height="64" rx="5" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Cab roof curve */}
      <path d="M8 38 Q8 20 24 20 L86 20 L86 28 L8 28 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Windshield — large, nearly full width */}
      <rect x="16" y="30" width="56" height="40" rx="5" fill="#dbeafe" fillOpacity="0.75" stroke="#93c5fd" strokeWidth="1" />

      {/* Headlight strip (modern led style) */}
      <rect x="8" y="30" width="12" height="18" rx="4" fill="#fef9c3" stroke="#fde047" strokeWidth="1" />
      {/* DRL */}
      <rect x="8" y="24" width="22" height="5" rx="2.5" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="0.8" />

      {/* Bumper */}
      <rect x="8" y="80" width="72" height="12" rx="4" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
      {/* Air intake / grille */}
      <rect x="16" y="76" width="44" height="6" rx="3" fill="#cbd5e1" />
      {[22, 30, 38, 46, 54].map(x => <line key={x} x1={x} y1="76" x2={x} y2="82" stroke="#b4bec8" strokeWidth="0.8" />)}

      {/* Mirror */}
      <path d="M4 42 L2 44 L2 54 L4 56 L10 54 L10 44 Z" fill="#dde3ea" stroke="#cbd5e1" strokeWidth="0.8" />

      {/* Cab step */}
      <rect x="8" y="89" width="80" height="4" rx="2" fill="#e2e8f0" />

      {/* Undercarriage */}
      <rect x="8" y="89" width="328" height="4" rx="2" fill="#e2e8f0" />

      {/* ── WHEELS ── */}
      <Wheel cx={50} cy={104} r={15} />
      {/* Rear dual */}
      <Wheel cx={246} cy={104} r={15} dual />
    </svg>
  )
}

// ── Hino 500 8T Large Truck ───────────────────────────────────────────────
export function LargeTruckSVG({ className = 'w-full' }) {
  return (
    <svg viewBox="0 0 430 118" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <ellipse cx="212" cy="113" rx="196" ry="5" fill="rgba(0,0,0,0.07)" />

      {/* ── CARGO BOX (very long) ── */}
      <rect x="90" y="14" width="320" height="78" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Roof rail */}
      <rect x="90" y="12" width="320" height="4" rx="2" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />

      {/* Teal accent stripe */}
      <rect x="90" y="58" width="320" height="14" fill={TEAL} opacity="0.1" />
      <rect x="90" y="58" width="320" height="3" fill={TEAL} opacity="0.45" />
      <rect x="90" y="69" width="320" height="3" fill={TEAL} opacity="0.45" />

      {/* Rear door */}
      <rect x="382" y="14" width="28" height="78" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
      <line x1="382" y1="14" x2="382" y2="92" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Door handle */}
      <rect x="394" y="50" width="12" height="5" rx="2.5" fill="#cbd5e1" />
      {/* Tail lift */}
      <rect x="408" y="82" width="8" height="12" rx="2" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
      {/* Rear lights */}
      <rect x="390" y="20" width="9" height="18" rx="3" fill="#fca5a5" stroke="#f87171" strokeWidth="1" />
      <rect x="390" y="44" width="9" height="10" rx="2" fill="#fed7aa" stroke="#fb923c" strokeWidth="0.8" />

      {/* Cargo text + volume */}
      <text x="240" y="42" textAnchor="middle" fontSize="10" fontFamily="'PingFang SC',Arial,sans-serif"
        fontWeight="800" fill={TEAL} opacity="0.65">迁喜搬家</text>
      <text x="240" y="54" textAnchor="middle" fontSize="7" fontFamily="Arial,sans-serif"
        fontWeight="600" fill="#94a3b8" letterSpacing="1">MOVE WITH EASE</text>
      <text x="240" y="84" textAnchor="middle" fontSize="9" fontFamily="Arial,sans-serif"
        fontWeight="700" fill={TEAL} opacity="0.5">30 m³</text>

      {/* ── CAB (cab-over, taller/wider than small truck) ── */}
      <rect x="8" y="22" width="84" height="70" rx="5" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Cab roof */}
      <path d="M8 34 Q8 14 26 14 L90 14 L90 22 L8 22 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Windshield */}
      <rect x="16" y="24" width="62" height="46" rx="6" fill="#dbeafe" fillOpacity="0.75" stroke="#93c5fd" strokeWidth="1" />

      {/* Headlight (rectangular modern) */}
      <rect x="8" y="26" width="12" height="20" rx="4" fill="#fef9c3" stroke="#fde047" strokeWidth="1" />
      {/* DRL */}
      <rect x="8" y="18" width="26" height="6" rx="3" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="0.8" />
      {/* Hino badge area */}
      <rect x="34" y="74" width="34" height="10" rx="3" fill={TEAL} opacity="0.15" />
      <text x="51" y="82" textAnchor="middle" fontSize="7" fontFamily="Arial,sans-serif"
        fontWeight="900" fill={TEAL} opacity="0.8" letterSpacing="1">HINO</text>

      {/* Bumper */}
      <rect x="8" y="82" width="78" height="10" rx="4" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
      {/* Grille */}
      <rect x="14" y="78" width="56" height="6" rx="3" fill="#cbd5e1" />
      {[20, 28, 36, 44, 52, 60].map(x => <line key={x} x1={x} y1="78" x2={x} y2="84" stroke="#b4bec8" strokeWidth="0.8" />)}

      {/* Mirror (larger) */}
      <path d="M4 40 L2 42 L2 56 L4 58 L12 56 L12 42 Z" fill="#dde3ea" stroke="#cbd5e1" strokeWidth="0.8" />

      {/* Cab step */}
      <rect x="8" y="89" width="84" height="4" rx="2" fill="#e2e8f0" />

      {/* Undercarriage */}
      <rect x="8" y="89" width="412" height="4" rx="2" fill="#e2e8f0" />

      {/* ── WHEELS ── */}
      <Wheel cx={52} cy={104} r={16} />
      {/* Rear tandem axle 1 */}
      <Wheel cx={296} cy={104} r={16} dual />
      {/* Rear tandem axle 2 */}
      <Wheel cx={362} cy={104} r={16} dual />
    </svg>
  )
}
