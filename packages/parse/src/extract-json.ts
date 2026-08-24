/** Extract a JSON object from model output (fences, prose, etc.). */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip markdown fences
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Find outermost { ... }
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Model output did not contain valid JSON");
  }
}
