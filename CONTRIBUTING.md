# Contributing

Thanks for helping improve Recipe Glance.

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

Node.js 20+ and pnpm 9 are expected.

## Pull requests

1. Open or comment on an issue before large behavior changes.
2. Add or update tests for schema, graph, layout, rendering, parsing, or CLI changes.
3. Add fixture documents under `examples/` for new supported format shapes.
4. Run `pnpm build && pnpm test` before pushing.
5. Keep commits focused and describe user-visible changes in the PR body.

## Compatibility

`rgf/0-draft` remains experimental. Breaking changes should be discussed first;
do not change the version string unless the community agrees on a migration.

## Style

- Preserve escaped HTML boundaries.
- Never trust LLM output: validate before layout or rendering.
- Do not invent missing recipe facts.
- Keep table fallback behavior conservative.
