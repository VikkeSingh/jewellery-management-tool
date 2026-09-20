const GOLD = '#b8860b';
const CX = 100;
const CY = 116;
const WREATH_R = 52;

function leafAt(deg, key) {
  const rad = (deg * Math.PI) / 180;
  const x = CX + WREATH_R * Math.cos(rad);
  const y = CY + WREATH_R * Math.sin(rad);
  return <ellipse key={key} cx={x} cy={y} rx="8.5" ry="3.2" transform={`rotate(${deg + 72} ${x} ${y})`} />;
}

const LEFT_LEAVES = [135, 150, 165, 180, 195, 210, 225];
const RIGHT_LEAVES = [45, 30, 15, 0, -15, -30, -45];

export default function LogoLJ({ size = 78 }) {
  return (
    <svg viewBox="0 0 200 195" width={size} height={size * (195 / 200)} role="img" aria-label="Lucky Jewellers">
      <g fill={GOLD}>
        <path d="M70 70 L74 46 L87 59 L100 34 L113 59 L126 46 L130 70 Z" />
        <circle cx="74" cy="42" r="3.2" />
        <circle cx="100" cy="30" r="4" />
        <circle cx="126" cy="42" r="3.2" />
        {LEFT_LEAVES.map((d, i) => leafAt(d, `l${i}`))}
        {RIGHT_LEAVES.map((d, i) => leafAt(d, `r${i}`))}
      </g>
      <circle cx={CX} cy={CY} r="44" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <circle cx={CX} cy={CY} r="37" fill="none" stroke={GOLD} strokeWidth="1.2" />
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="42"
        fontWeight="700"
        fill={GOLD}
      >
        LJ
      </text>
      <path d="M68 168 C78 177, 89 177, 96 171" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      <path d="M132 168 C122 177, 111 177, 104 171" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      <circle cx={CX} cy="172" r="2.8" fill={GOLD} />
    </svg>
  );
}
