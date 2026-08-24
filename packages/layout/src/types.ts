export type LayoutWarning = {
  code:
    | "LAYOUT_NON_CONTIGUOUS"
    | "LAYOUT_TABLE_UNSUPPORTED"
    | "LAYOUT_EMPTY"
    | "LAYOUT_INFO";
  message: string;
  stepIds?: string[];
};

export type TableRow = {
  /** MaterialUse id for ingredient-sourced rows. */
  useId: string;
  ingredientId: string;
  displayText: string;
  portion?: string;
};

export type SetupRow = {
  stepId: string;
  text: string;
  /** "350°F (170°C) · 15 min" */
  detail?: string;
  attention: "active" | "passive";
};

export type DerivedAction = {
  stepId: string;
  label: string;
  instruction: string;
  kind?: string;
  /**
   * Bare verb for the cell headline — `label` with any temperature/duration
   * text stripped, since those render as their own typographic tier.
   */
  verb: string;
  /** "350°F · 30–40 min" — secondary tier under the verb. */
  detail?: string;
  /** "until a toothpick comes out clean" — tertiary tier. */
  doneness?: string;
  /** Hands-off steps get a distinct visual treatment. */
  attention: "active" | "passive";
  /** Contiguous row spans (inclusive indices into rows[]). */
  spans: { fromRow: number; toRow: number }[];
  /** Nesting depth for column assignment (0 = outermost-ish; higher = deeper). */
  depth: number;
};

export type CardBlock = {
  stepId: string;
  label: string;
  instruction: string;
  kind?: string;
  detail?: string;
  doneness?: string;
  attention: "active" | "passive";
  inputs: string[];
  outputs: string[];
  after: string[];
};

/**
 * Derived from normalized step durations. `total` is the critical path through
 * the graph (parallel branches overlap); `active` is the sum of hands-on time,
 * which cannot overlap. Undefined when the source gave no usable times.
 */
export type Timing = {
  totalMinutes?: number;
  activeMinutes?: number;
  /** True when at least one step lacked a normalized duration. */
  partial: boolean;
};

export type TableLayout = {
  mode: "table";
  title: string;
  servings?: string;
  setupRows: SetupRow[];
  rows: TableRow[];
  actions: DerivedAction[];
  /** Deduped union of step equipment, in first-use order. */
  equipment: string[];
  timing: Timing;
  /** Max depth among actions (for column count). */
  maxDepth: number;
  warnings: LayoutWarning[];
};

export type CardLayout = {
  mode: "card";
  title: string;
  servings?: string;
  reason: string;
  blocks: CardBlock[];
  equipment: string[];
  timing: Timing;
  warnings: LayoutWarning[];
};

export type LayoutResult = TableLayout | CardLayout;

export type LayoutOptions = {
  /**
   * Prefer table; fall back to card when any transform step cannot form
   * contiguous spans over ingredient-use rows.
   * @default true
   */
  allowCardFallback?: boolean;
  /** Force card layout. */
  forceCard?: boolean;
};
