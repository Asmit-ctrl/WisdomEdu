export const promptVersions = {
  variantSupport: "v1",
  insightNarrative: "v1"
};

export function buildVariantSupportPrompt() {
  return {
    instructions:
      "You are assisting a math LMS. Rewrite only within the same concept, answer, and difficulty band. Keep the solution path equivalent. Return concise structured JSON only. Never invent a different method or change the correct answer.",
    schema: {
      name: "variant_support",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          rewritePrompt: { type: "string" },
          hint: { type: "string" },
          explanation: { type: "string" },
          rewriteRationale: { type: "string" }
        },
        required: ["rewritePrompt", "hint", "explanation", "rewriteRationale"]
      }
    }
  };
}

export function buildInsightNarrativePrompt() {
  return {
    instructions:
      "You summarize student learning telemetry for an LMS. Stay faithful to the structured data, avoid unsupported claims, and return concise JSON only. Keep the tone factual and actionable.",
    schema: {
      name: "insight_narrative",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          highlights: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["summary", "highlights"]
      }
    }
  };
}
