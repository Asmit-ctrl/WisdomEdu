import { config } from "./config.js";
import { buildInsightNarrativePrompt, buildVariantSupportPrompt, promptVersions } from "./aiPrompts.js";

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  for (const item of payload?.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (typeof content?.text === "string" && content.text.trim()) {
        chunks.push(content.text.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

async function createResponsesRequest({ model, instructions, input, schema }) {
  if (!config.openaiApiKey || !config.openaiEnableEnhancedGeneration) {
    return null;
  }

  const body = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: instructions }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: input }]
      }
    ]
  };

  if (schema) {
    body.text = {
      format: {
        type: "json_schema",
        name: schema.name,
        strict: true,
        schema: schema.schema
      }
    };
  }

  const response = await fetch(`${config.openaiBaseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed: ${response.status} ${payload}`.trim());
  }

  return response.json();
}

export function hasOpenAIEnhancements() {
  return Boolean(config.openaiApiKey && config.openaiEnableEnhancedGeneration);
}

export async function generateVariantSupport({ template, context }) {
  if (!hasOpenAIEnhancements()) {
    return null;
  }

  const prompt = buildVariantSupportPrompt();
  const payload = await createResponsesRequest({
    model: config.openaiVariantModel,
    instructions: prompt.instructions,
    input: JSON.stringify({
      template: {
        topic: template.topic,
        prompt: template.prompt,
        questionType: template.questionType,
        options: template.options ?? [],
        correctAnswer: template.correctAnswer,
        explanation: template.explanation,
        difficultyLevel: template.difficultyLevel
      },
      context,
      promptVersion: promptVersions.variantSupport
    }),
    schema: prompt.schema
  });

  const text = extractOutputText(payload);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function generateInsightNarrative({ role, structuredContext }) {
  if (!hasOpenAIEnhancements()) {
    return null;
  }

  const prompt = buildInsightNarrativePrompt();
  const payload = await createResponsesRequest({
    model: config.openaiInsightModel,
    instructions: prompt.instructions,
    input: JSON.stringify({ role, structuredContext, promptVersion: promptVersions.insightNarrative }),
    schema: prompt.schema
  });

  const text = extractOutputText(payload);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
