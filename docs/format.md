# Recipe Glance Format (`rgf/0-draft`)

Operation-graph recipe standard. **The graph is canonical; table spans are derived.**

## Principles

1. **Material flow ≠ prerequisites.** `uses` carries ingredients/outputs into a step. `after` orders non-consumed prerequisites (preheat, grease pan, chill bowl).
2. **Uses and outputs are first-class** (`MaterialUse.id`, `StepOutput.id`).
3. **Setup steps** live in the graph (`kind: "setup"`), not a disconnected preamble list.
4. **Array order** is author narrative order and the layout tie-breaker.
5. **`instruction`** is a faithful *atomic* action. Original multi-clause sentences live in `evidence`.
6. **Ingredient `text` is authoritative.** Rich quantity ASTs are postponed.
7. Layout may fall back to **card** when a table would be misleading.

## Document shape

See `packages/schema` and `packages/schema/json-schema/rgf-0-draft.json` (generated on build).

```ts
RecipeDocument {
  version: "rgf/0-draft"
  meta: { title, servings?, ... }
  ingredients: Ingredient[]
  steps: Step[]
  warnings?: ParseWarning[]
}
```

### Step

| Field | Meaning |
|-------|---------|
| `kind` | `setup` \| `transform` \| `wait` \| `serve` |
| `instruction` | Atomic faithful text |
| `label` | Compact table cell — a **bare verb phrase** (`bake`, not `bake 350°F 30 min`) |
| `uses` | Material inputs (ingredient or prior output) |
| `after` | Prerequisite step ids (not consumed) |
| `outputs` | Named products of this step |
| `duration` | `{ raw, minMinutes?, maxMinutes? }` — normalize for derived totals |
| `temperature` | `{ raw, value?, unit? }` |
| `doneness` | Short sensory finish cue: `"until a toothpick comes out clean"` |
| `attention` | `active` \| `passive` — passive means the cook walks away |
| `equipment` | Tools this step needs, in the source's wording |

All of `duration`…`equipment` are optional and **must never be invented** — a
parser omits the field rather than guessing.

`attention` defaults to `passive` for `kind: "wait"` and `active` otherwise.

## Layout policy

1. Table rows = **ingredient-use occurrences** (not bare ingredient ids).
2. Engine may reorder rows to make spans contiguous.
3. If any transform step still has non-contiguous leaves → **card fallback** + `LAYOUT_TABLE_UNSUPPORTED`.
4. Never invent a single span that hides a branch/merge.

## Derived presentation values

The layout engine computes these; they are never stored in the document.

| Value | Derivation |
|-------|-----------|
| `action.verb` / `action.detail` | `label` split from `temperature`/`duration` so each gets its own typographic tier |
| `timing.totalMinutes` | **Critical path** through the graph — parallel branches (dough proofing while the pan heats) overlap rather than summing |
| `timing.activeMinutes` | Plain sum of `active` step durations, since hands-on work cannot overlap |
| `timing.partial` | A non-setup step lacked a normalized duration, so totals are a lower bound |
| `equipment` | Deduped union across steps, in first-use order |

## Rendering model

The renderer draws **no grid lines**. Regions are separated by fills:

1. Each ingredient row is an unbroken colour band that runs rightward and
   terminates in the block that consumes it — this is the format's core
   affordance and takes priority over any styling concern.
2. Operation blocks are tinted by graph **depth**, so the cascade toward the
   final step is legible at a glance.
3. `passive` steps are hatched and tagged, surfacing the cook's free stretches.
4. Non-overlapping actions at the same depth are **packed into one column**
   rather than each claiming its own.

## Validation

`validateRecipeDocument` enforces Zod shape, referential integrity, unique ids, and acyclicity of material+`after` edges.

## Versioning

`rgf/0-draft` until Phase A exit criteria and a broader fixture set justify `rgf/1`.
