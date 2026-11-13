/**
 * Hand-drawn illustrations for the family sign-up and tracker, in the site's palette.
 * Plain inline SVG: no image hosts, nothing to download, crisp at any size. All decorative (aria-hidden):
 * the text beside each one says the same thing. Motion classes (kx-*) stop for people who ask for less motion.
 */

const C = {
  forest: "#0b3f2a",
  leaf: "#14683f",
  lime: "#86d92b",
  mint: "#eff5ee",
  mint2: "#e3eee1",
  line: "#e1e7e0",
  sun: "#f5b83d",
  sunSoft: "#fdf3d7",
  sunDeep: "#c98a12",
  panel: "#23425e",
  panelLine: "#6f8fae",
  grey: "#b9c1bc",
  greyDark: "#7d8882",
  white: "#ffffff",
};

/** A house seen from the front, 100 × 90 in its own units. Panels sit on the roof when the home has solar. */
function House({ panels = true, lit = true }: { panels?: boolean; lit?: boolean }) {
  return (
    <g>
      <polygon points="2,42 20,10 80,10 98,42" fill={C.forest} />
      {panels && (
        <g>
          <polygon points="26,15 74,15 85,37 15,37" fill={C.panel} />
          <path d="M20.5 26 H79.5 M38 15 L32.5 37 M50 15 V37 M62 15 L67.5 37" stroke={C.panelLine} strokeWidth="1.3" />
          <polygon points="26,15 74,15 76,19 24,19" fill="#ffffff" opacity="0.12" />
        </g>
      )}
      <rect x="10" y="40" width="80" height="48" rx="2" fill={C.white} stroke={C.forest} strokeWidth="2.5" />
      <rect x="43" y="60" width="15" height="28" rx="2" fill={C.leaf} />
      <circle cx="54" cy="75" r="1.4" fill={C.lime} />
      {[18, 66].map((x) => (
        <g key={x}>
          <rect x={x} y="51" width="16" height="14" rx="1.5" fill={lit ? C.sunSoft : C.mint2} stroke={C.forest} strokeWidth="2" />
          <path d={`M${x + 8} 51 V65 M${x} 58 H${x + 16}`} stroke={C.forest} strokeWidth="1.3" />
        </g>
      ))}
    </g>
  );
}

function SunRays({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return { x1: cx + Math.cos(a) * (r + 5), y1: cy + Math.sin(a) * (r + 5), x2: cx + Math.cos(a) * (r + 11), y2: cy + Math.sin(a) * (r + 11) };
  });
  return (
    <g>
      <g className="kx-spin-slow">
        {rays.map((l, i) => (
          <line key={i} {...l} stroke={C.sun} strokeWidth="3" strokeLinecap="round" />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r} fill={C.sun} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.35} fill="#ffffff" opacity="0.25" />
    </g>
  );
}

/** A small petrol generator, 40 × 30 in its own units. */
function Generator() {
  return (
    <g>
      <rect x="0" y="6" width="38" height="22" rx="3" fill={C.grey} stroke={C.greyDark} strokeWidth="2" />
      <rect x="5" y="11" width="13" height="9" rx="1.5" fill={C.greyDark} />
      <path d="M23 12 H33 M23 16 H33 M23 20 H33" stroke={C.greyDark} strokeWidth="1.6" />
      <rect x="31" y="0" width="4" height="7" fill={C.greyDark} />
      <circle cx="7" cy="30" r="4" fill={C.greyDark} />
      <circle cx="31" cy="30" r="4" fill={C.greyDark} />
    </g>
  );
}

/** Welcome: a Lagos home under the sun, panels on the roof, money coming in, and the old generator on its way out. */
export function HeroIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden focusable="false">
      <ellipse cx="205" cy="148" rx="182" ry="104" fill={C.mint} />
      <ellipse cx="205" cy="222" rx="165" ry="14" fill={C.mint2} />
      <SunRays cx={330} cy={58} r={22} />
      <path d="M306 76 Q 258 78 232 116" fill="none" stroke={C.sun} strokeWidth="3" strokeDasharray="5 6" strokeLinecap="round" className="kx-flow" />
      <g transform="translate(140 104) scale(1.18)">
        <House />
      </g>
      {/* A plant beside the house */}
      <g transform="translate(296 150)">
        <rect x="9" y="30" width="5" height="40" rx="2" fill={C.leaf} />
        <circle cx="11" cy="24" r="17" fill={C.leaf} />
        <circle cx="22" cy="34" r="11" fill={C.lime} opacity="0.85" />
        <circle cx="1" cy="34" r="10" fill={C.lime} opacity="0.6" />
      </g>
      {/* Carbon income */}
      <g transform="translate(278 108)">
        <circle cx="16" cy="16" r="17" fill={C.lime} />
        <circle cx="16" cy="16" r="12.5" fill="none" stroke={C.forest} strokeWidth="1.5" opacity="0.35" />
        <text x="16" y="22" textAnchor="middle" fontSize="17" fontWeight="700" fill={C.forest} fontFamily="system-ui, sans-serif">₦</text>
      </g>
      {/* The generator, greyed and drifting away, with a trade-in tag */}
      <g transform="translate(46 178)">
        <g className="kx-drift-away">
          <Generator />
          <circle cx="40" cy="-4" r="3" fill={C.grey} opacity="0.5" />
          <circle cx="46" cy="-11" r="2" fill={C.grey} opacity="0.35" />
        </g>
        <path d="M-6 44 H44" stroke={C.greyDark} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.6" />
        <g transform="translate(-14 -24)">
          <rect width="62" height="18" rx="9" fill={C.white} stroke={C.line} strokeWidth="1.5" />
          <path d="M15 9 H7 M10 6 L7 9 L10 12" fill="none" stroke={C.leaf} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <text x="20" y="12.5" fontSize="8.5" fontWeight="600" fill={C.forest} fontFamily="system-ui, sans-serif">Trade-in</text>
        </g>
      </g>
    </svg>
  );
}

/** "I need solar": a home with an empty roof and a panel on its way. */
export function NeedSolarArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 80" className={className} aria-hidden focusable="false">
      <circle cx="48" cy="44" r="36" fill={C.mint2} />
      <g transform="translate(18 34) scale(0.6)">
        <House panels={false} lit={false} />
      </g>
      <g transform="translate(52 6) rotate(-12)">
        <polygon points="6,0 30,0 36,14 0,14" fill={C.panel} />
        <path d="M3 7 H33 M14 0 L12 14 M22 0 L24 14" stroke={C.panelLine} strokeWidth="1.1" />
      </g>
      <circle cx="80" cy="30" r="8" fill={C.lime} />
      <path d="M80 26 V34 M76 30 H84" stroke={C.forest} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** "I already have solar": a home with panels, linked up to KlimateX. */
export function HaveSolarArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 80" className={className} aria-hidden focusable="false">
      <circle cx="48" cy="44" r="36" fill={C.mint2} />
      <circle cx="78" cy="14" r="8" fill={C.sun} />
      <g transform="translate(18 34) scale(0.6)">
        <House />
      </g>
      <circle cx="78" cy="58" r="11" fill={C.lime} />
      <path d="M73 58.5 L76.8 62.2 L83.5 55" fill="none" stroke={C.forest} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type SpotKind =
  | "package"
  | "payment"
  | "loan"
  | "phone"
  | "code"
  | "account"
  | "request"
  | "inverter"
  | "generator"
  | "tradein"
  | "installer"
  | "survey"
  | "quote"
  | "install"
  | "accepted"
  | "verified"
  | "certificate"
  | "alert"
  | "payout"
  | "readings"
  | "home"
  | "changed"
  | "cancelled";

/** The drawing inside a spot, in a 64 × 64 box. */
function SpotGlyph({ kind }: { kind: SpotKind }) {
  const stroke = { fill: "none", stroke: C.forest, strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "package":
      return (
        <>
          <circle cx="47" cy="17" r="7" fill={C.sun} />
          <polygon points="14,46 22,28 50,28 56,46" fill={C.panel} />
          <path d="M18 37 H53 M29 28 L24.5 46 M36 28 L35 46 M43 28 L45.5 46" stroke={C.panelLine} strokeWidth="1.3" />
          <path d="M35 46 V52 M27 53 H43" {...stroke} />
        </>
      );
    case "payment":
      return (
        <>
          <rect x="9" y="17" width="34" height="23" rx="4" fill={C.forest} />
          <rect x="9" y="22" width="34" height="4" fill={C.leaf} />
          <rect x="14" y="30" width="8" height="5" rx="1" fill={C.sun} />
          {[50, 45, 40].map((y) => (
            <ellipse key={y} cx="44" cy={y} rx="11" ry="4.2" fill={C.sun} stroke={C.sunDeep} strokeWidth="1.2" />
          ))}
        </>
      );
    case "loan":
      return (
        <>
          <polygon points="10,25 30,13 50,25" fill={C.forest} />
          {[14, 23, 32, 41].map((x) => (
            <rect key={x} x={x} y="27" width="5" height="16" rx="1" fill={C.leaf} />
          ))}
          <rect x="10" y="44" width="40" height="5" rx="1.5" fill={C.forest} />
          <circle cx="49" cy="46" r="9" fill={C.lime} />
          <path d="M49 50.5 V41.5 M45 45.5 L49 41.5 L53 45.5" {...stroke} strokeWidth={2.2} />
        </>
      );
    case "phone":
    case "code":
      return (
        <>
          <rect x="17" y="9" width="24" height="46" rx="5" fill={C.forest} />
          <rect x="20" y="14" width="18" height="34" rx="2" fill={C.white} />
          {kind === "phone" ? (
            <>
              <rect x="29" y="18" width="26" height="13" rx="6.5" fill={C.lime} />
              {[36, 42, 48].map((x) => (
                <circle key={x} cx={x} cy="24.5" r="1.6" fill={C.forest} />
              ))}
              <rect x="23" y="36" width="10" height="3" rx="1.5" fill={C.line} />
              <rect x="23" y="41" width="7" height="3" rx="1.5" fill={C.line} />
            </>
          ) : (
            <>
              {[22, 27.5, 33].map((x) => (
                <rect key={x} x={x} y="26" width="4" height="6" rx="1" fill={C.leaf} />
              ))}
              <circle cx="46" cy="44" r="9" fill={C.lime} />
              <path d="M41.8 44 L45 47.2 L50.5 41" {...stroke} strokeWidth={2.2} />
            </>
          )}
        </>
      );
    case "account":
      return (
        <>
          <polygon points="8,31 22,19 36,31" fill={C.forest} />
          <rect x="11" y="30" width="22" height="18" rx="1" fill={C.white} stroke={C.forest} strokeWidth="2" />
          <rect x="19" y="37" width="6" height="11" rx="1" fill={C.leaf} />
          <circle cx="46" cy="27" r="6.5" fill={C.forest} />
          <path d="M35 51 a11 10.5 0 0 1 22 0 Z" fill={C.leaf} />
        </>
      );
    case "request":
      return (
        <>
          <path d="M9 47 Q 16 42 23 45" fill="none" stroke={C.leaf} strokeWidth="2" strokeDasharray="3 3.5" strokeLinecap="round" />
          <polygon points="12,31 54,14 42,49 32,38" fill={C.white} stroke={C.forest} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M32 38 L54 14 M32 38 L34 47 L38 42" {...stroke} strokeWidth={2.2} />
        </>
      );
    case "inverter":
      return (
        <>
          <rect x="16" y="9" width="32" height="46" rx="4" fill={C.white} stroke={C.forest} strokeWidth="2.5" />
          <rect x="22" y="15" width="20" height="11" rx="2" fill={C.forest} />
          <path d="M25 23 V20 M28.5 23 V18 M32 23 V19.5 M35.5 23 V17.5" stroke={C.lime} strokeWidth="1.8" strokeLinecap="round" />
          <rect x="21" y="33" width="22" height="15" rx="1.5" fill={C.sunSoft} stroke={C.sun} strokeWidth="1.4" />
          <path d="M24 36 V45 M26.5 36 V45 M28 36 V45 M31 36 V45 M33.5 36 V45 M35 36 V45 M38 36 V45 M40 36 V45" stroke={C.forest} strokeWidth="1" />
        </>
      );
    case "generator":
      return (
        <g transform="translate(12 18)">
          <Generator />
        </g>
      );
    case "tradein":
      return (
        <>
          <g transform="translate(18 23) scale(0.72)">
            <Generator />
          </g>
          <path d="M12 30 A21 21 0 0 1 46 13" {...stroke} stroke={C.leaf} strokeWidth={2.6} />
          <path d="M41 10 L46.5 13 L42.5 18" {...stroke} stroke={C.leaf} strokeWidth={2.4} />
          <path d="M52 36 A21 21 0 0 1 18 51" {...stroke} stroke={C.leaf} strokeWidth={2.6} />
          <path d="M23 54 L17.5 51 L21.5 46" {...stroke} stroke={C.leaf} strokeWidth={2.4} />
        </>
      );
    case "installer":
      return (
        <>
          <rect x="7" y="22" width="34" height="21" rx="3" fill={C.white} stroke={C.forest} strokeWidth="2.2" />
          <polygon points="12,27 34,27 36,37 10,37" fill={C.panel} />
          <path d="M23 27 V37 M11 32 H35" stroke={C.panelLine} strokeWidth="1" />
          <path d="M41 28 H50 L57 36 V43 H41 Z" fill={C.forest} />
          <path d="M44 31 H49 L53.5 36 H44 Z" fill={C.mint2} />
          {[17, 47].map((x) => (
            <g key={x}>
              <circle cx={x} cy="45" r="5.5" fill={C.forest} />
              <circle cx={x} cy="45" r="2" fill={C.white} />
            </g>
          ))}
        </>
      );
    case "survey":
      return (
        <>
          <rect x="15" y="12" width="34" height="43" rx="4" fill={C.white} stroke={C.forest} strokeWidth="2.4" />
          <rect x="25" y="8" width="14" height="8" rx="2" fill={C.forest} />
          <polygon points="23,32 32,24 41,32" fill={C.leaf} />
          <rect x="25.5" y="31" width="13" height="9" fill="none" stroke={C.leaf} strokeWidth="2" />
          <rect x="21" y="45" width="22" height="3" rx="1.5" fill={C.line} />
        </>
      );
    case "quote":
      return (
        <>
          <path d="M17 9 H47 V53 l-5 -3.5 l-5 3.5 l-5 -3.5 l-5 3.5 l-5 -3.5 l-5 3.5 Z" fill={C.white} stroke={C.forest} strokeWidth="2.3" strokeLinejoin="round" />
          <rect x="22" y="16" width="20" height="3" rx="1.5" fill={C.line} />
          <rect x="22" y="22" width="13" height="3" rx="1.5" fill={C.line} />
          <text x="32" y="43" textAnchor="middle" fontSize="15" fontWeight="700" fill={C.leaf} fontFamily="system-ui, sans-serif">₦</text>
        </>
      );
    case "install":
      return (
        <>
          <rect x="11" y="15" width="42" height="38" rx="4" fill={C.white} stroke={C.forest} strokeWidth="2.3" />
          <path d="M11 19 a4 4 0 0 1 4 -4 H49 a4 4 0 0 1 4 4 V25 H11 Z" fill={C.forest} />
          <rect x="21" y="10" width="3.5" height="9" rx="1.5" fill={C.forest} />
          <rect x="39.5" y="10" width="3.5" height="9" rx="1.5" fill={C.forest} />
          <path d="M23 39 L29 45 L41 32" {...stroke} stroke={C.leaf} strokeWidth={3.2} />
        </>
      );
    case "accepted":
      return (
        <>
          <circle cx="27" cy="23" r="8" fill={C.forest} />
          <path d="M11 51 a16 14 0 0 1 32 0 Z" fill={C.leaf} />
          <circle cx="45" cy="40" r="10" fill={C.lime} />
          <path d="M40 40 L43.8 43.8 L50.5 36.5" {...stroke} strokeWidth={2.6} />
        </>
      );
    case "verified":
      return (
        <>
          <path d="M32 9 L49 15.5 V30 C49 42 41 50 32 55 C23 50 15 42 15 30 V15.5 Z" fill={C.leaf} />
          <path d="M24.5 32 L30 37.5 L40.5 26" fill="none" stroke={C.white} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "certificate":
      return (
        <>
          <rect x="12" y="9" width="32" height="42" rx="3" fill={C.white} stroke={C.forest} strokeWidth="2.3" />
          <rect x="17" y="16" width="22" height="3" rx="1.5" fill={C.line} />
          <rect x="17" y="22" width="15" height="3" rx="1.5" fill={C.line} />
          <rect x="17" y="28" width="18" height="3" rx="1.5" fill={C.line} />
          <polygon points="38,46 34,57 39,54 42,58 44,48" fill={C.forest} />
          <polygon points="46,46 50,57 45,54 42,58 40,48" fill={C.leaf} />
          <circle cx="42" cy="42" r="10" fill={C.lime} stroke={C.white} strokeWidth="2" />
          <text x="42" y="46.5" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.forest} fontFamily="system-ui, sans-serif">A</text>
        </>
      );
    case "alert":
      return (
        <>
          <path d="M14 22 Q 10 30 14 38 M50 22 Q 54 30 50 38" fill="none" stroke={C.leaf} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M21 42 V31 a11 11 0 0 1 22 0 V42 l3.5 4 H17.5 Z" fill={C.forest} />
          <circle cx="32" cy="50" r="3.5" fill={C.forest} />
          <circle cx="44" cy="19" r="6" fill={C.sun} stroke={C.white} strokeWidth="2" />
        </>
      );
    case "payout":
      return (
        <>
          {[49, 43.5, 38, 32.5].map((y) => (
            <ellipse key={y} cx="25" cy={y} rx="13" ry="4.8" fill={C.sun} stroke={C.sunDeep} strokeWidth="1.2" />
          ))}
          <path d="M34 34 C33 20 45 12 56 12 C56 25 49 35 34 34 Z" fill={C.lime} />
          <path d="M37 31 C42 25 47 20 52 16" fill="none" stroke={C.forest} strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case "readings":
      return (
        <>
          <rect x="9" y="15" width="44" height="35" rx="4" fill={C.white} stroke={C.forest} strokeWidth="2.3" />
          <path d="M14 42 L22 35 L29 38 L37 27 L44 30 L48 22" fill="none" stroke={C.leaf} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="51" cy="13" r="6" fill={C.sun} />
        </>
      );
    case "home":
      return (
        <g transform="translate(10 12) scale(0.44)">
          <House panels={false} />
        </g>
      );
    case "changed":
      return (
        <>
          <path d="M14 26 A18 18 0 0 1 47 20" {...stroke} stroke={C.leaf} strokeWidth={2.8} />
          <path d="M42 15 L47.5 20 L41.5 24" {...stroke} stroke={C.leaf} strokeWidth={2.6} />
          <path d="M50 38 A18 18 0 0 1 17 44" {...stroke} strokeWidth={2.8} />
          <path d="M22 49 L16.5 44 L22.5 40" {...stroke} strokeWidth={2.6} />
        </>
      );
    case "cancelled":
      return (
        <>
          <circle cx="32" cy="32" r="19" fill={C.white} stroke={C.greyDark} strokeWidth="2.5" />
          <rect x="25.5" y="23.5" width="4.5" height="17" rx="1.5" fill={C.greyDark} />
          <rect x="34" y="23.5" width="4.5" height="17" rx="1.5" fill={C.greyDark} />
        </>
      );
  }
}

/** A small square illustration: a perk, a sign-up step or a tracker stage. */
export function Spot({ kind, size = 56, className = "", tone = "mint" }: { kind: SpotKind; size?: number; className?: string; tone?: "mint" | "white" | "sun" }) {
  const bg = tone === "white" ? C.white : tone === "sun" ? C.sunSoft : C.mint2;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden focusable="false">
      <rect width="64" height="64" rx="18" fill={bg} />
      <SpotGlyph kind={kind} />
    </svg>
  );
}

/** The family's home with a badge for where their sign-up is. Panels appear once the home has (or gets) solar. */
export function StageScene({ kind, panels, className = "" }: { kind: SpotKind; panels: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 160 124" className={className} aria-hidden focusable="false">
      <circle cx="74" cy="66" r="56" fill={C.mint} />
      <ellipse cx="74" cy="112" rx="58" ry="6" fill={C.mint2} />
      <SunRays cx={128} cy={24} r={11} />
      <g transform="translate(26 32) scale(0.86)">
        <House panels={panels} lit={kind !== "cancelled"} />
      </g>
      <svg x="102" y="64" width="54" height="54" viewBox="0 0 64 64">
        <rect x="1" y="1" width="62" height="62" rx="18" fill={C.white} stroke={C.line} strokeWidth="2" />
        <SpotGlyph kind={kind} />
      </svg>
    </svg>
  );
}

/** The four steps from sign-up to payout, for the explainer. */
export const HOW_IT_WORKS: { kind: SpotKind; title: string; body: string }[] = [
  { kind: "package", title: "Choose or link", body: "Pick a solar package, or link the inverter you already have." },
  { kind: "installer", title: "An installer visits", body: "A KlimateX installer fits your system or checks the one you have." },
  { kind: "readings", title: "We read it daily", body: "Your inverter reports what your panels make. We count the petrol you didn't burn." },
  { kind: "payout", title: "You get paid", body: "Checked savings become carbon credits. Half of what buyers pay goes to your family." },
];
