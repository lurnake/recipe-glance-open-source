#!/usr/bin/env node
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRecipeDocument } from "@recipe-glance/schema";
import { layoutRecipe } from "@recipe-glance/layout";
import {
  renderRecipe,
  wrapHtmlDocument,
  isThemeId,
  DEFAULT_THEME,
  type ThemeId,
} from "@recipe-glance/renderer";
import { parseRecipe, createProvider } from "@recipe-glance/parse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

function usage(): never {
  console.log(`rgf — Recipe Glance CLI

Usage:
  rgf validate <file.json> [...]
  rgf layout <file.json>
  rgf render <file.json> [--theme basic] [--out file.html] [--force-card]
  rgf render --all [--theme basic] [--out-dir dir]
  rgf parse <file.txt|file.md> [--out file.json] [--image file.png]
  rgf convert <file.txt> [--theme basic] [--out file.html]

Examples:
  rgf validate examples/02-wet-dry-merge-brownies.json
  rgf render examples/02-wet-dry-merge-brownies.json --theme basic
  rgf parse recipe.txt --out recipe.json
  GEMINI_API_KEY=... rgf convert recipe.txt --out out.html
`);
  process.exit(1);
}

function resolveInput(path: string): string {
  if (isAbsolute(path) && existsSync(path)) return path;
  const fromCwd = resolve(path);
  if (existsSync(fromCwd)) return fromCwd;
  const fromRoot = resolve(repoRoot, path);
  if (existsSync(fromRoot)) return fromRoot;
  return fromCwd;
}

function loadDoc(path: string) {
  const resolved = resolveInput(path);
  const raw = JSON.parse(readFileSync(resolved, "utf8"));
  const result = validateRecipeDocument(raw);
  if (!result.ok) {
    console.error(`Invalid: ${path}`);
    for (const issue of result.issues) {
      console.error(`  - ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
    return null;
  }
  return result.document;
}

function mimeFromPath(p: string): string {
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();
  const cmd = args[0];

  if (cmd === "validate") {
    const files = args.slice(1);
    if (files.length === 0) usage();
    let ok = true;
    for (const f of files) {
      const doc = loadDoc(f);
      if (doc) console.log(`OK  ${f} — ${doc.meta.title}`);
      else ok = false;
    }
    process.exit(ok ? 0 : 1);
  }

  if (cmd === "layout") {
    const file = args[1];
    if (!file) usage();
    const doc = loadDoc(file);
    if (!doc) process.exit(1);
    console.log(JSON.stringify(layoutRecipe(doc), null, 2));
    return;
  }

  if (cmd === "parse" || cmd === "convert") {
    let out: string | undefined;
    let imagePath: string | undefined;
    let theme: ThemeId = DEFAULT_THEME;
    const files: string[] = [];
    for (let i = 1; i < args.length; i++) {
      const a = args[i]!;
      if (a === "--out") out = args[++i];
      else if (a === "--image") imagePath = args[++i];
      else if (a === "--theme") {
        const t = args[++i];
        if (!t || !isThemeId(t)) {
          console.error("Invalid theme");
          process.exit(1);
        }
        theme = t;
      } else if (!a.startsWith("-")) files.push(a);
      else {
        console.error(`Unknown flag ${a}`);
        process.exit(1);
      }
    }
    if (files.length !== 1 && !imagePath) usage();

    const text = files[0]
      ? readFileSync(resolveInput(files[0]!), "utf8")
      : undefined;
    let image:
      | { base64: string; mimeType: string }
      | undefined;
    if (imagePath) {
      const buf = readFileSync(resolveInput(imagePath));
      image = {
        base64: buf.toString("base64"),
        mimeType: mimeFromPath(imagePath),
      };
    }

    const provider = createProvider();
    console.error(`Using provider: ${provider.name}`);
    try {
      const parsed = await parseRecipe({ text, image }, { provider });
      if (cmd === "parse") {
        const json = JSON.stringify(parsed.document, null, 2);
        if (out) {
          const target = out.startsWith("/") ? out : resolve(process.cwd(), out);
          writeFileSync(target, json);
          console.error(
            `Wrote ${target} (${parsed.provider}, repairs=${parsed.repairs})`,
          );
        } else {
          process.stdout.write(json + "\n");
        }
        return;
      }
      // convert
      const { html, layoutMode } = renderRecipe(parsed.document, { theme });
      const page = wrapHtmlDocument(html, parsed.document.meta.title);
      if (out) {
        const target = out.startsWith("/") ? out : resolve(process.cwd(), out);
        writeFileSync(target, page);
        console.error(`Wrote ${target} (${layoutMode}, ${parsed.provider})`);
      } else {
        process.stdout.write(page);
      }
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
    return;
  }

  if (cmd === "render") {
    let theme: ThemeId = DEFAULT_THEME;
    let out: string | undefined;
    let outDir: string | undefined;
    let forceCard = false;
    let all = false;
    const files: string[] = [];

    for (let i = 1; i < args.length; i++) {
      const a = args[i]!;
      if (a === "--theme") {
        const t = args[++i];
        if (!t || !isThemeId(t)) {
          console.error("Invalid theme");
          process.exit(1);
        }
        theme = t;
      } else if (a === "--out") {
        out = args[++i];
      } else if (a === "--out-dir") {
        outDir = args[++i];
      } else if (a === "--force-card") {
        forceCard = true;
      } else if (a === "--all") {
        all = true;
      } else if (a.startsWith("-")) {
        console.error(`Unknown flag ${a}`);
        process.exit(1);
      } else {
        files.push(a);
      }
    }

    if (all) {
      const examples = join(repoRoot, "examples");
      const list = readdirSync(examples).filter((f) => f.endsWith(".json"));
      const dir = outDir
        ? isAbsolute(outDir)
          ? outDir
          : resolve(repoRoot, outDir)
        : join(repoRoot, "dist", "previews");
      mkdirSync(dir, { recursive: true });
      for (const f of list) {
        const doc = loadDoc(join(examples, f));
        if (!doc) continue;
        const { html, layoutMode } = renderRecipe(doc, { theme, forceCard });
        const page = wrapHtmlDocument(html, doc.meta.title);
        const target = join(dir, f.replace(/\.json$/, ".html"));
        writeFileSync(target, page);
        console.log(`Wrote ${target} (${layoutMode})`);
      }
      return;
    }

    if (files.length !== 1) usage();
    const doc = loadDoc(files[0]!);
    if (!doc) process.exit(1);
    const { html, layoutMode, warnings } = renderRecipe(doc, {
      theme,
      forceCard,
    });
    const page = wrapHtmlDocument(html, doc.meta.title);
    if (out) {
      writeFileSync(out.startsWith("/") ? out : resolve(process.cwd(), out), page);
      console.log(`Wrote ${out} (${layoutMode})`);
    } else {
      process.stdout.write(page);
    }
    for (const w of warnings) {
      console.error(`[${w.code}] ${w.message}`);
    }
    return;
  }

  usage();
}

main();
