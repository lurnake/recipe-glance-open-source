# Recipe Glance Open Source

Recipe Glance Format (`rgf/0-draft`) is a small JSON graph for recipes. It
separates material flow (`uses`) from ordering constraints (`after`), so a UI can
show what happens to each ingredient, where branches and merges occur, which
steps overlap, and when the cook is hands-free.

This repository contains the open-source SDK, renderer, parser pipeline, web
component, CLI, examples, and tests. It intentionally does **not** include the
hosted API, billing, deployment configuration, or the commercial style catalog.
The renderer ships one neutral `basic` theme; bring your own styles by changing
its design tokens.

## Packages

| Package | Purpose |
|---|---|
| `@recipe-glance/schema` | Types, Zod validation, generated JSON Schema |
| `@recipe-glance/layout` | Graph to table spans or accessible card fallback |
| `@recipe-glance/renderer` | Escaped HTML/CSS with the basic open-source style |
| `@recipe-glance/parse` | Provider-agnostic LLM parsing and validation |
| `@recipe-glance/embed` | `<recipe-glance>` custom element |
| `@recipe-glance/cli` | Validate, inspect, render, parse, and convert |

## Quick start

Requires Node.js 20+ and pnpm 9.

```bash
pnpm install
pnpm build
pnpm test
```

Render the bundled fixtures:

```bash
pnpm validate:examples
pnpm preview:examples
open dist/previews/02-wet-dry-merge-brownies.html
```

Use the CLI:

```bash
pnpm cli validate examples/01-linear-vinaigrette.json
pnpm cli layout examples/05-parallel-wait-bread.json
pnpm cli render examples/02-wet-dry-merge-brownies.json --theme basic --out recipe.html
```

The parser defaults to an offline mock provider when no key is configured:

```bash
pnpm cli parse examples/prose/garlic-pasta.txt --out parsed.json
pnpm cli convert examples/prose/garlic-pasta.txt --out recipe.html
```

## Use your own LLM

`createProvider()` has built-in clients for Gemini, xAI, any OpenAI-compatible
Chat Completions endpoint, and a deterministic offline mock. Configure it from
environment variables or pass explicit values in code.

```bash
export GEMINI_API_KEY="..."
export GEMINI_MODEL="gemini-flash-latest"
pnpm cli parse recipe.txt --out recipe.json
```

For xAI:

```bash
export XAI_API_KEY="..."
export XAI_MODEL="grok-3-mini"
pnpm cli parse recipe.txt --out recipe.json
```

For an OpenAI-compatible service:

```bash
export OPENAI_API_KEY="..."
export OPENAI_BASE_URL="https://your-service.example/v1"
export OPENAI_MODEL="your-model"
pnpm cli parse recipe.txt --out recipe.json
```

In application code you can also implement the tiny `LlmProvider` interface and
use any model or local inference server:

```ts
import { parseRecipe, type LlmProvider } from "@recipe-glance/parse";

const provider: LlmProvider = {
  name: "my-provider",
  complete: async (request) => ({
    text: await callMyModel(request),
    model: "my-model",
    provider: "my-provider",
  }),
};

const result = await parseRecipe({ text: recipeText }, { provider });
console.log(result.document);
```

The prompt asks for JSON only, validates the response against the schema, checks
graph invariants, and attempts one repair round if validation fails.

## Embed

Build `packages/embed`, load its output, and add:

```html
<recipe-glance src="/recipes/pasta.json" theme="basic"></recipe-glance>
<script type="module" src="/scripts/recipe-glance.js"></script>
```

The component validates JSON before rendering and isolates styles in shadow DOM.

## Basic styling

The open-source renderer emits structural CSS plus scoped variables under
`.rgf.rgf--basic`. The default palette is deliberately plain. You can override
variables such as `--rgf-ground`, `--rgf-accent`, `--rgf-tint-0` through
`--rgf-tint-4`, fonts, radius, and spacing without replacing the layout engine.

## Format

See [docs/format.md](./docs/format.md). In short:

- Ingredients are named resources; each use is distinct.
- Steps consume ingredients or prior outputs through `uses`.
- Non-consumed prerequisites use `after`.
- Durations are normalized for critical-path timing when supplied.
- Table spans are derived, never stored as authoritative data.
- Unsafe or non-contiguous graphs fall back to an ordered card list.

## Attribution

This project independently implements a compact tabular recipe presentation.
The underlying visual idea was devised by Michael Chu at
[Cooking for Engineers](https://www.cookingforengineers.com/). This repository
does not inject that attribution into rendered output.

Commercial styles and hosted parsing remain separate products.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md), then run formatting-equivalent type
checks, build, and tests locally. Keep changes focused and add fixtures for new
format behavior.

## Security

Do not report vulnerabilities in a public issue. See
[SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
