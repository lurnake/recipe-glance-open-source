export type ThemeId = "basic";

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  tagline: string;
  swatches: { bg: string; border: string; accent: string };
};

export const DEFAULT_THEME: ThemeId = "basic";

export const THEME_META: ThemeMeta[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "A neutral starting point you can restyle with CSS variables",
    swatches: {
      bg: "#ffffff",
      border: "#d4d4d4",
      accent: "#2563eb",
    },
  },
];

export const THEME_IDS: ThemeId[] = THEME_META.map((theme) => theme.id);

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as string[]).includes(value);
}

export function getThemeMeta(id: ThemeId): ThemeMeta {
  return THEME_META.find((theme) => theme.id === id) ?? THEME_META[0]!;
}

/** Number of steps in the depth tint ramp; deeper actions clamp to the last. */
export const TINT_STEPS = 5;

type ThemeTokens = {
  ground: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkSoft: string;
  rule: string;
  accent: string;
  qty: string;
  tints: string[];
  onTints: string[];
  font: string;
  titleFont: string;
  monoFont: string;
  radius: string;
  gap: string;
  shadow: string;
  titleTracking: string;
  verbCase: "none" | "uppercase";
  verbVariant: "normal" | "small-caps";
  verbTracking: string;
};

const THEMES: Record<ThemeId, ThemeTokens> = {
  basic: {
    ground: "#ffffff",
    surface: "#f8fafc",
    surfaceAlt: "#eef2f7",
    ink: "#172033",
    inkSoft: "#5b6575",
    rule: "#d9e0e8",
    accent: "#2563eb",
    qty: "#2563eb",
    tints: ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#2563eb"],
    onTints: ["#172033", "#132038", "#0d1c34", "#ffffff", "#ffffff"],
    font: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    titleFont:
      'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    monoFont: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    radius: "6px",
    gap: "4px",
    shadow: "none",
    titleTracking: "0",
    verbCase: "none",
    verbVariant: "normal",
    verbTracking: "0",
  },
};

export type ThemePreview = {
  ground: string;
  surface: string;
  ink: string;
  accent: string;
  ramp: string[];
};

export function themePreview(id: ThemeId): ThemePreview {
  const theme = THEMES[id] ?? THEMES.basic;
  return {
    ground: theme.ground,
    surface: theme.surface,
    ink: theme.ink,
    accent: theme.accent,
    ramp: [...theme.tints],
  };
}

/** Scoped design tokens for a style. */
export function themeCss(theme: ThemeId): string {
  const value = THEMES[theme] ?? THEMES.basic;
  const ramp = value.tints
    .map(
      (tint, index) =>
        `  --rgf-tint-${index}: ${tint};\n  --rgf-on-${index}: ${value.onTints[index]};`,
    )
    .join("\n");

  return `
.rgf.rgf--${theme} {
  --rgf-ground: ${value.ground};
  --rgf-surface: ${value.surface};
  --rgf-surface-alt: ${value.surfaceAlt};
  --rgf-ink: ${value.ink};
  --rgf-ink-soft: ${value.inkSoft};
  --rgf-rule: ${value.rule};
  --rgf-accent: ${value.accent};
  --rgf-qty: ${value.qty};
${ramp}
  --rgf-font: ${value.font};
  --rgf-title-font: ${value.titleFont};
  --rgf-mono: ${value.monoFont};
  --rgf-radius: ${value.radius};
  --rgf-gap: ${value.gap};
  --rgf-shadow: ${value.shadow};
  --rgf-title-tracking: ${value.titleTracking};
  --rgf-verb-case: ${value.verbCase};
  --rgf-verb-variant: ${value.verbVariant};
  --rgf-verb-tracking: ${value.verbTracking};
}
`;
}

/**
 * Structural CSS shared by every style. Ingredient rows remain joined to the
 * operation that consumes them; visual identity is supplied by tokens above.
 */
export const BASE_CSS = `
.rgf {
  box-sizing: border-box;
  margin: 0;
  padding: 1rem;
  max-width: 100%;
  overflow-x: auto;
  color: var(--rgf-ink);
  background: var(--rgf-ground);
  border: 1px solid var(--rgf-rule);
  border-radius: calc(var(--rgf-radius) + 4px);
  font-family: var(--rgf-font);
  font-size: 15px;
  line-height: 1.35;
}
.rgf *, .rgf *::before, .rgf *::after { box-sizing: border-box; }

.rgf__head { display: block; }
.rgf__title {
  font-family: var(--rgf-title-font);
  font-size: clamp(1.25rem, 1.05rem + 0.8vw, 1.55rem);
  font-weight: 700;
  letter-spacing: var(--rgf-title-tracking);
  line-height: 1.15;
  margin: 0;
}
.rgf__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.85rem;
  margin: 0.45rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.76rem;
  color: var(--rgf-ink-soft);
}
.rgf__fact { display: inline-flex; gap: 0.28rem; }
.rgf__fact b {
  font-family: var(--rgf-mono);
  font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
  color: var(--rgf-ink);
}
.rgf__fact--hero b { color: var(--rgf-accent); }
.rgf__gear { margin: 0.5rem 0 0; font-size: 0.72rem; }
.rgf__gear-item {
  display: inline-block;
  margin: 0 0.28rem 0.28rem 0;
  padding: 0.08rem 0.5rem;
  border: 1px solid var(--rgf-rule);
  border-radius: 99px;
  color: var(--rgf-ink-soft);
}
.rgf__hr {
  height: 2px;
  margin: 0.75rem 0 0.6rem;
  border: 0;
  background: var(--rgf-accent);
}

.rgf__table {
  width: 100%;
  border-collapse: collapse;
}
.rgf__table td {
  border: 0;
  padding: 0.45rem 0.55rem;
  vertical-align: middle;
}
.rgf__setup td {
  background: var(--rgf-tint-0);
  color: var(--rgf-on-0);
  font-weight: 600;
}
.rgf__setup-mark {
  margin-right: 0.5rem;
  font-family: var(--rgf-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--rgf-accent);
}
.rgf__setup-detail {
  display: block;
  font-family: var(--rgf-mono);
  font-size: 0.72rem;
  opacity: 0.75;
}
.rgf__ing {
  width: 34%;
  min-width: 10rem;
  text-align: left;
  background: var(--rgf-surface);
}
.rgf__ing--alt { background: var(--rgf-surface-alt); }
.rgf__qty {
  margin-right: 0.35rem;
  font-family: var(--rgf-mono);
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--rgf-qty);
}
.rgf__flow {
  min-width: 1rem;
  padding: 0;
  background: var(--rgf-surface);
}
.rgf__flow--alt { background: var(--rgf-surface-alt); }
.rgf__op {
  min-width: 3rem;
  max-width: 11rem;
  padding: 0.45rem 0.5rem;
  text-align: center;
  background: var(--rgf-tint-1);
  color: var(--rgf-on-1);
}
.rgf__op--d0 { background: var(--rgf-tint-0); color: var(--rgf-on-0); }
.rgf__op--d1 { background: var(--rgf-tint-1); color: var(--rgf-on-1); }
.rgf__op--d2 { background: var(--rgf-tint-2); color: var(--rgf-on-2); }
.rgf__op--d3 { background: var(--rgf-tint-3); color: var(--rgf-on-3); }
.rgf__op--d4 { background: var(--rgf-tint-4); color: var(--rgf-on-4); }
.rgf__op--passive {
  background-image: repeating-linear-gradient(
    -45deg,
    transparent 0 5px,
    rgba(128, 128, 128, 0.16) 5px 10px
  );
}
.rgf__verb {
  display: block;
  font-weight: 700;
  font-size: 0.94rem;
  line-height: 1.2;
  text-transform: var(--rgf-verb-case);
  font-variant: var(--rgf-verb-variant);
  letter-spacing: var(--rgf-verb-tracking);
}
.rgf__detail {
  display: block;
  margin-top: 0.2rem;
  font-family: var(--rgf-mono);
  font-size: 0.71rem;
  opacity: 0.85;
}
.rgf__cue { display: none; }
.rgf__tag {
  display: inline-block;
  margin-top: 0.25rem;
  padding: 0.02rem 0.35rem;
  border: 1px solid currentColor;
  border-radius: 99px;
  font-family: var(--rgf-mono);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.65;
}
.rgf__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.rgf__card-list {
  display: flex;
  flex-direction: column;
  gap: var(--rgf-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}
.rgf__card-item {
  padding: 0.6rem 0.7rem;
  border-left: 3px solid var(--rgf-tint-3);
  background: var(--rgf-surface);
  border-radius: var(--rgf-radius);
}
.rgf__card-item--passive { border-left-style: dashed; }
.rgf__card-label { margin: 0; font-weight: 700; }
.rgf__card-kind {
  margin-left: 0.35rem;
  font-family: var(--rgf-mono);
  font-size: 0.62rem;
  color: var(--rgf-accent);
  text-transform: uppercase;
}
.rgf__card-detail {
  margin: 0.2rem 0 0;
  font-family: var(--rgf-mono);
  font-size: 0.73rem;
  color: var(--rgf-ink-soft);
}
.rgf__card-inputs {
  margin: 0.3rem 0 0;
  padding-left: 1rem;
  color: var(--rgf-ink-soft);
}
.rgf__fallback-note {
  margin: 0 0 0.6rem;
  font-style: italic;
  color: var(--rgf-ink-soft);
}
.rgf__credit {
  margin: 0.75rem 0 0;
  font-size: 0.68rem;
  color: var(--rgf-ink-soft);
}
.rgf__credit a { color: var(--rgf-accent); }

@media (max-width: 560px) {
  .rgf { padding: 0.8rem; font-size: 14px; }
  .rgf__table td { padding: 0.38rem; }
  .rgf__ing { min-width: 7.25rem; width: 40%; }
  .rgf__op { min-width: 2.35rem; }
}
`;
