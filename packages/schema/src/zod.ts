import { z } from "zod";
import { RGF_VERSION } from "./types.js";

export const SourceEvidenceSchema = z.object({
  sourceId: z.string().min(1),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  snippet: z.string().optional(),
});

export const IngredientSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  quantityNote: z.string().optional(),
  itemNote: z.string().optional(),
  notes: z.array(z.string()).optional(),
  evidence: z.array(SourceEvidenceSchema).optional(),
});

export const MaterialUseSchema = z.object({
  id: z.string().min(1),
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("ingredient"),
      ingredientId: z.string().min(1),
    }),
    z.object({
      kind: z.literal("output"),
      outputId: z.string().min(1),
    }),
  ]),
  portion: z.string().optional(),
});

export const StepOutputSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
});

export const DurationSchema = z.object({
  raw: z.string(),
  minMinutes: z.number().nonnegative().optional(),
  maxMinutes: z.number().nonnegative().optional(),
});

export const TemperatureSchema = z.object({
  raw: z.string(),
  value: z.number().optional(),
  unit: z.enum(["C", "F"]).optional(),
});

export const StepSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["setup", "transform", "wait", "serve"]).optional(),
  instruction: z.string().min(1),
  label: z.string().optional(),
  uses: z.array(MaterialUseSchema),
  after: z.array(z.string().min(1)).optional(),
  outputs: z.array(StepOutputSchema).optional(),
  duration: DurationSchema.optional(),
  temperature: TemperatureSchema.optional(),
  doneness: z.string().optional(),
  attention: z.enum(["active", "passive"]).optional(),
  equipment: z.array(z.string().min(1)).optional(),
  evidence: z.array(SourceEvidenceSchema).optional(),
});

export const ParseWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  subjectIds: z.array(z.string()).optional(),
});

export const RecipeMetaSchema = z.object({
  title: z.string().min(1),
  servings: z.string().optional(),
  yield: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  locale: z.string().optional(),
});

export const RecipeDocumentSchema = z.object({
  version: z.literal(RGF_VERSION),
  meta: RecipeMetaSchema,
  ingredients: z.array(IngredientSchema),
  steps: z.array(StepSchema),
  warnings: z.array(ParseWarningSchema).optional(),
});
