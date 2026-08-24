export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ImagePart = {
  mimeType: string;
  /** Base64 without data: prefix */
  base64: string;
};

export type LlmRequest = {
  messages: ChatMessage[];
  /** Optional image attached to the last user turn (multimodal). */
  image?: ImagePart;
  temperature?: number;
  maxTokens?: number;
};

export type LlmResponse = {
  text: string;
  model: string;
  provider: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type LlmProvider = {
  name: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
};

export type ProviderConfig = {
  /** gemini | xai | openai-compatible | mock */
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

/**
 * Create an LLM provider from env-style config.
 * Defaults: Gemini Flash-Lite when GEMINI_API_KEY set;
 * else xAI when XAI_API_KEY set; else mock.
 */
export function createProvider(config: ProviderConfig = {}): LlmProvider {
  const provider =
    config.provider ??
    (config.apiKey || processEnv("GEMINI_API_KEY")
      ? "gemini"
      : processEnv("XAI_API_KEY")
        ? "xai"
        : processEnv("OPENAI_API_KEY")
          ? "openai"
          : "mock");

  if (provider === "mock") {
    return createMockProvider();
  }

  if (provider === "gemini") {
    return createGeminiProvider({
      apiKey: config.apiKey ?? processEnv("GEMINI_API_KEY") ?? "",
      model: config.model ?? processEnv("GEMINI_MODEL") ?? "gemini-flash-latest",
    });
  }

  if (provider === "xai") {
    return createOpenAiCompatibleProvider({
      name: "xai",
      apiKey: config.apiKey ?? processEnv("XAI_API_KEY") ?? "",
      baseUrl: config.baseUrl ?? "https://api.x.ai/v1",
      model: config.model ?? processEnv("XAI_MODEL") ?? "grok-3-mini",
    });
  }

  return createOpenAiCompatibleProvider({
    name: "openai",
    apiKey: config.apiKey ?? processEnv("OPENAI_API_KEY") ?? "",
    baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
    model: config.model ?? processEnv("OPENAI_MODEL") ?? "gpt-4o-mini",
  });
}

function processEnv(key: string): string | undefined {
  try {
    // eslint-disable-next-line no-undef
    return typeof process !== "undefined" ? process.env?.[key] : undefined;
  } catch {
    return undefined;
  }
}

function createGeminiProvider(opts: {
  apiKey: string;
  model: string;
}): LlmProvider {
  return {
    name: "gemini",
    async complete(req) {
      if (!opts.apiKey) {
        throw new Error("GEMINI_API_KEY is required for gemini provider");
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;

      const system = req.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const contents = req.messages
        .filter((m) => m.role !== "system")
        .map((m, idx, arr) => {
          const parts: Record<string, unknown>[] = [{ text: m.content }];
          if (
            m.role === "user" &&
            idx === arr.length - 1 &&
            req.image
          ) {
            parts.push({
              inline_data: {
                mime_type: req.image.mimeType,
                data: req.image.base64,
              },
            });
          }
          return {
            role: m.role === "assistant" ? "model" : "user",
            parts,
          };
        });

      const body = {
        system_instruction: system
          ? { parts: [{ text: system }] }
          : undefined,
        contents,
        generationConfig: {
          temperature: req.temperature ?? 0.2,
          maxOutputTokens: req.maxTokens ?? 8192,
          responseMimeType: "application/json",
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 500)}`);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("") ?? "";
      return {
        text,
        model: opts.model,
        provider: "gemini",
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
        },
      };
    },
  };
}

function createOpenAiCompatibleProvider(opts: {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}): LlmProvider {
  return {
    name: opts.name,
    async complete(req) {
      if (!opts.apiKey) {
        throw new Error(`API key required for provider ${opts.name}`);
      }
      const messages = req.messages.map((m, idx, arr) => {
        if (
          m.role === "user" &&
          idx === arr.length - 1 &&
          req.image
        ) {
          return {
            role: "user",
            content: [
              { type: "text", text: m.content },
              {
                type: "image_url",
                image_url: {
                  url: `data:${req.image.mimeType};base64,${req.image.base64}`,
                },
              },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages,
          temperature: req.temperature ?? 0.2,
          max_tokens: req.maxTokens ?? 8192,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `${opts.name} API ${res.status}: ${errText.slice(0, 500)}`,
        );
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        model: opts.model,
        provider: opts.name,
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
      };
    },
  };
}

/** Deterministic mock for tests / offline demo (simple linear recipe). */
export function createMockProvider(): LlmProvider {
  return {
    name: "mock",
    async complete(req) {
      const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
      let text = lastUser?.content ?? "";
      // Strip our wrapper prompt if present
      text = text
        .replace(/^Convert this recipe into[^\n]*\n+/i, "")
        .replace(/^Convert the recipe shown[\s\S]*?Accompanying text:\n/i, "")
        .replace(/^\(none\)\n*/i, "");
      const title = firstLineTitle(text) || "Parsed Recipe";

      // Extremely small heuristic: lines that look like ingredients
      const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const ingredients: { id: string; text: string }[] = [];
      for (const line of lines) {
        if (/^[-*•]/.test(line) || /^\d/.test(line)) {
          const cleaned = line.replace(/^[-*•]\s*/, "");
          if (cleaned.length > 2 && cleaned.length < 120) {
            ingredients.push({
              id: `ing${ingredients.length + 1}`,
              text: cleaned,
            });
          }
        }
      }
      if (ingredients.length === 0) {
        ingredients.push(
          { id: "ing1", text: "ingredient A (mock)" },
          { id: "ing2", text: "ingredient B (mock)" },
        );
      }

      const uses = ingredients.map((ing, i) => ({
        id: `u${i + 1}`,
        source: { kind: "ingredient" as const, ingredientId: ing.id },
      }));

      const doc = {
        version: "rgf/0-draft",
        meta: {
          title: title.slice(0, 80),
          notes: "Parsed with mock provider (set GEMINI_API_KEY or XAI_API_KEY for real parse)",
        },
        ingredients,
        steps: [
          {
            id: "combine",
            kind: "transform",
            instruction: "Combine ingredients as directed in the source recipe",
            label: "combine",
            uses,
            outputs: [{ id: "out1", name: "mixture" }],
          },
        ],
        warnings: [
          {
            code: "MOCK_PROVIDER",
            message:
              "Mock parser used — structure is approximate. Configure an API key for full LLM parse.",
          },
        ],
      };

      // If repair prompt, return a still-valid minimal doc
      if (text.includes("failed validation")) {
        return {
          text: JSON.stringify(doc),
          model: "mock",
          provider: "mock",
        };
      }

      return {
        text: JSON.stringify(doc),
        model: "mock",
        provider: "mock",
      };
    },
  };
}

function firstLineTitle(text: string): string | null {
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (
      t &&
      !/^convert\b/i.test(t) &&
      !/^ingredients\b/i.test(t) &&
      !/^steps?\b/i.test(t) &&
      !/^serves?\b/i.test(t) &&
      !/^accompanying text/i.test(t) &&
      !/\brgf\//i.test(t) &&
      t.length < 80 &&
      !/^[-*•]/.test(t) &&
      !/^\d+\./.test(t)
    ) {
      return t;
    }
  }
  return null;
}
