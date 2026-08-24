import {
  validateRecipeDocument,
  type RecipeDocument,
  type ValidationIssue,
} from "@recipe-glance/schema";
import { extractJsonObject } from "./extract-json.js";
import {
  SYSTEM_PROMPT,
  FEW_SHOT_USER,
  FEW_SHOT_ASSISTANT,
  buildUserPrompt,
  buildRepairPrompt,
} from "./prompt.js";
import {
  createProvider,
  type ImagePart,
  type LlmProvider,
  type ProviderConfig,
} from "./providers.js";

export type ParseInput = {
  text?: string;
  image?: ImagePart;
};

export type ParseOptions = {
  provider?: LlmProvider;
  providerConfig?: ProviderConfig;
  /** Max repair attempts after first parse (default 1). */
  maxRepairs?: number;
  temperature?: number;
};

export type ParseResult = {
  document: RecipeDocument;
  rawModelText: string;
  repairs: number;
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  issuesFixed: ValidationIssue[];
};

export type ParseError = {
  ok: false;
  error: string;
  rawModelText?: string;
  issues?: ValidationIssue[];
  provider?: string;
};

/**
 * Parse recipe text and/or image into a validated RecipeDocument.
 * Pipeline: LLM → JSON extract → validate → optional repair pass.
 */
export async function parseRecipe(
  input: ParseInput,
  options: ParseOptions = {},
): Promise<ParseResult> {
  if (!input.text?.trim() && !input.image) {
    throw Object.assign(new Error("Provide text and/or image"), {
      ok: false as const,
    });
  }

  const provider =
    options.provider ?? createProvider(options.providerConfig ?? {});
  const maxRepairs = options.maxRepairs ?? 1;

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: FEW_SHOT_USER },
    { role: "assistant" as const, content: FEW_SHOT_ASSISTANT },
    {
      role: "user" as const,
      content: buildUserPrompt({
        text: input.text,
        imageNote: input.image
          ? "An image of the recipe is attached. Transcribe and structure it."
          : undefined,
      }),
    },
  ];

  let totalIn = 0;
  let totalOut = 0;
  let lastModel = provider.name;
  let lastProvider = provider.name;

  const first = await provider.complete({
    messages,
    image: input.image,
    temperature: options.temperature ?? 0.2,
  });
  lastModel = first.model;
  lastProvider = first.provider;
  totalIn += first.usage?.inputTokens ?? 0;
  totalOut += first.usage?.outputTokens ?? 0;

  let raw = first.text;
  let parsedUnknown: unknown;
  try {
    parsedUnknown = extractJsonObject(raw);
  } catch (e) {
    throw Object.assign(
      new Error((e as Error).message),
      {
        ok: false as const,
        rawModelText: raw,
        provider: lastProvider,
      } satisfies Partial<ParseError>,
    );
  }

  let validation = validateRecipeDocument(parsedUnknown);
  const issuesFixed: ValidationIssue[] = [];
  let repairs = 0;

  while (!validation.ok && repairs < maxRepairs) {
    repairs++;
    const repairUser = buildRepairPrompt(
      JSON.stringify(parsedUnknown, null, 2),
      validation.issues,
    );
    const repairRes = await provider.complete({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: repairUser },
      ],
      temperature: 0.1,
    });
    lastModel = repairRes.model;
    lastProvider = repairRes.provider;
    totalIn += repairRes.usage?.inputTokens ?? 0;
    totalOut += repairRes.usage?.outputTokens ?? 0;
    raw = repairRes.text;
    try {
      parsedUnknown = extractJsonObject(raw);
    } catch (e) {
      throw Object.assign(new Error((e as Error).message), {
        ok: false as const,
        rawModelText: raw,
        issues: validation.issues,
        provider: lastProvider,
      });
    }
    const prevIssues = validation.issues;
    validation = validateRecipeDocument(parsedUnknown);
    if (validation.ok) {
      issuesFixed.push(...prevIssues);
    }
  }

  if (!validation.ok) {
    throw Object.assign(
      new Error(
        `Parse produced invalid RGF after ${repairs} repair(s): ${validation.issues.map((i) => i.message).join("; ")}`,
      ),
      {
        ok: false as const,
        rawModelText: raw,
        issues: validation.issues,
        provider: lastProvider,
      },
    );
  }

  return {
    document: validation.document,
    rawModelText: raw,
    repairs,
    provider: lastProvider,
    model: lastModel,
    usage:
      totalIn || totalOut
        ? { inputTokens: totalIn, outputTokens: totalOut }
        : undefined,
    issuesFixed,
  };
}
