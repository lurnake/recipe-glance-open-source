/** Recipe Glance Format — draft version tag. */
export const RGF_VERSION = "rgf/0-draft" as const;
export type RgfVersion = typeof RGF_VERSION;

export type SourceEvidence = {
  /** Which input blob (primary text, page-2, image-0, …). */
  sourceId: string;
  /** Char offset inclusive. */
  start?: number;
  /** Char offset exclusive. */
  end?: number;
  bbox?: { x: number; y: number; w: number; h: number };
  /** Optional human aid; not the sole locator. */
  snippet?: string;
};

export type Ingredient = {
  id: string;
  /** Authoritative display line. */
  text: string;
  quantityNote?: string;
  itemNote?: string;
  notes?: string[];
  evidence?: SourceEvidence[];
};

export type MaterialUseSource =
  | { kind: "ingredient"; ingredientId: string }
  | { kind: "output"; outputId: string };

export type MaterialUse = {
  /** Occurrence identity — layout rows key off this. */
  id: string;
  source: MaterialUseSource;
  portion?: string;
};

export type StepOutput = {
  id: string;
  name?: string;
};

export type StepKind = "setup" | "transform" | "wait" | "serve";

/**
 * Whether the cook is occupied for the step's duration.
 * `passive` = it happens without you (bake, rise, chill, marinate).
 */
export type Attention = "active" | "passive";

export type Duration = {
  /** Authoritative display string, original wording. */
  raw: string;
  /** Normalized wall-clock minutes. Both set to the same value when exact. */
  minMinutes?: number;
  maxMinutes?: number;
};

export type Temperature = {
  /** Authoritative display string, original wording. */
  raw: string;
  value?: number;
  unit?: "C" | "F";
};

export type Step = {
  id: string;
  kind?: StepKind;
  /** Faithful atomic instruction for this graph node. */
  instruction: string;
  /** Compact cell label when shorter than instruction. Bare verb: "melt", "fold in". */
  label?: string;
  uses: MaterialUse[];
  /** Non-material prerequisites (step ids). */
  after?: string[];
  outputs?: StepOutput[];
  duration?: Duration;
  temperature?: Temperature;
  /** Sensory finish cue: "until a toothpick comes out clean". */
  doneness?: string;
  /** Defaults to passive for `wait`, active otherwise. */
  attention?: Attention;
  /** Tools this step needs: "8x8-in pan", "stand mixer". */
  equipment?: string[];
  evidence?: SourceEvidence[];
};

export type ParseWarning = {
  code: string;
  message: string;
  subjectIds?: string[];
};

export type RecipeMeta = {
  title: string;
  servings?: string;
  yield?: string;
  source?: string;
  notes?: string;
  locale?: string;
};

/**
 * Canonical recipe document: operation graph.
 * Array order = narrative order and layout tie-breaker.
 */
export type RecipeDocument = {
  version: RgfVersion;
  meta: RecipeMeta;
  ingredients: Ingredient[];
  steps: Step[];
  warnings?: ParseWarning[];
};
