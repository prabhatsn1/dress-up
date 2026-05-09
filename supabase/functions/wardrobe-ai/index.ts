// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type WeatherSnapshot = {
  location: string;
  temperatureC: number;
  condition: "Sunny" | "Cloudy" | "Rain";
  rainChance: number;
  dayPart: "Morning" | "Afternoon" | "Evening";
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getOpenAiOutputText(payload: any) {
  if (
    typeof payload?.output_text === "string" &&
    payload.output_text.length > 0
  ) {
    return payload.output_text;
  }

  const content = payload?.output?.[0]?.content ?? [];
  const textPart = content.find(
    (part: any) => part?.type === "output_text" || part?.type === "text",
  );

  return textPart?.text ?? null;
}

async function callOpenAi(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing in Supabase Edge Function secrets.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function callHuggingFaceSegmentation(imageUrl: string) {
  const hfToken = Deno.env.get("HF_TOKEN");

  if (!hfToken) {
    return {
      labels: [] as string[],
      backgroundRemovalSuggested: false,
    };
  }

  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    throw new Error(
      `Unable to fetch wardrobe image for Hugging Face: ${imageResponse.status}`,
    );
  }

  const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  const bytes = await imageResponse.arrayBuffer();
  const segmentationResponse = await fetch(
    "https://router.huggingface.co/hf-inference/models/briaai/RMBG-2.0",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": contentType,
      },
      body: bytes,
    },
  );

  if (!segmentationResponse.ok) {
    const errorText = await segmentationResponse.text();
    throw new Error(
      `Hugging Face segmentation failed: ${segmentationResponse.status} ${errorText}`,
    );
  }

  const rawSegments = (await segmentationResponse.json()) as Array<{
    label?: string;
    score?: number;
  }>;
  const labels = rawSegments
    .filter((segment) => typeof segment.label === "string")
    .sort((first, second) => (second.score ?? 0) - (first.score ?? 0))
    .slice(0, 4)
    .map((segment) => segment.label as string);

  return {
    labels,
    backgroundRemovalSuggested: labels.length > 0,
  };
}

function wardrobeAnalysisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      category: {
        type: "string",
        enum: ["Top", "Bottom", "Outerwear", "Shoes", "Accessory"],
      },
      subcategory: { type: "string" },
      fit: { type: "string", enum: ["slim", "regular", "oversized"] },
      sleeve: {
        type: ["string", "null"],
        enum: ["sleeveless", "short", "long", null],
      },
      colours: {
        type: "array",
        items: { type: "string" },
      },
      pattern: {
        type: "string",
        enum: ["solid", "stripes", "checks", "textured"],
      },
      seasons: {
        type: "array",
        items: {
          type: "string",
          enum: ["summer", "winter", "monsoon", "all-season"],
        },
      },
      occasions: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "Office",
            "Party",
            "Date",
            "Wedding",
            "Casual",
            "Gym",
            "Travel",
          ],
        },
      },
      formality: {
        type: "string",
        enum: ["casual", "smart", "formal", "festive", "athleisure"],
      },
      material: { type: "string" },
      confidence: { type: "number" },
      summary: { type: "string" },
      styleNotes: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "name",
      "category",
      "subcategory",
      "fit",
      "sleeve",
      "colours",
      "pattern",
      "seasons",
      "occasions",
      "formality",
      "material",
      "confidence",
      "summary",
      "styleNotes",
    ],
  };
}

function stylistSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      headline: { type: "string" },
      confidence: { type: "number" },
      summary: { type: "string" },
      reasons: {
        type: "array",
        items: { type: "string" },
      },
      primaryItemIds: {
        type: "array",
        items: { type: "string" },
      },
      backupOptions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            itemIds: {
              type: "array",
              items: { type: "string" },
            },
            reason: { type: "string" },
          },
          required: ["itemIds", "reason"],
        },
      },
      accessorySuggestion: { type: ["string", "null"] },
      stylistNote: { type: "string" },
    },
    required: [
      "headline",
      "confidence",
      "summary",
      "reasons",
      "primaryItemIds",
      "backupOptions",
      "accessorySuggestion",
      "stylistNote",
    ],
  };
}

async function analyzeItem(body: { imageUrl: string; itemName?: string }) {
  const hf = await callHuggingFaceSegmentation(body.imageUrl).catch(() => ({
    labels: [] as string[],
    backgroundRemovalSuggested: false,
  }));

  const openAiPayload = await callOpenAi({
    model: Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-5.4-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Analyze this single wardrobe item image for a closet app. ` +
              `Return concise, structured tags only for the item itself, not the background. ` +
              `Use realistic fashion metadata and avoid guessing extreme details. ` +
              `Existing label hint: ${body.itemName ?? "unknown item"}.`,
          },
          {
            type: "input_image",
            image_url: body.imageUrl,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "wardrobe_item_analysis",
        strict: true,
        schema: wardrobeAnalysisSchema(),
      },
    },
  });

  const outputText = getOpenAiOutputText(openAiPayload);

  if (!outputText) {
    throw new Error("OpenAI did not return structured analysis text.");
  }

  const parsed = JSON.parse(outputText);

  return {
    ...parsed,
    segmentationLabels: hf.labels,
    backgroundRemovalSuggested: hf.backgroundRemovalSuggested,
  };
}

function pairingsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      headline: { type: "string" },
      stylistNote: { type: "string" },
      pairings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            itemIds: { type: "array", items: { type: "string" } },
            occasion: { type: "string" },
            reason: { type: "string" },
          },
          required: ["itemIds", "occasion", "reason"],
        },
      },
      missingPieceSuggestion: { type: ["string", "null"] },
    },
    required: ["headline", "stylistNote", "pairings", "missingPieceSuggestion"],
  };
}

async function suggestPairings(body: {
  anchorItem: Record<string, unknown>;
  wardrobeItems: Array<Record<string, unknown>>;
}) {
  const simplifiedItems = body.wardrobeItems.map((item: any) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    colours: item.colours,
    occasions: item.occasions,
    formality: item.formality,
    material: item.material,
    favorite: item.favorite,
    aiSummary: item.aiSummary ?? null,
  }));

  const anchor: any = body.anchorItem;
  const simplifiedAnchor = {
    id: anchor.id,
    name: anchor.name,
    category: anchor.category,
    subcategory: anchor.subcategory,
    colours: anchor.colours,
    occasions: anchor.occasions,
    formality: anchor.formality,
    material: anchor.material,
    aiSummary: anchor.aiSummary ?? null,
  };

  const openAiPayload = await callOpenAi({
    model: Deno.env.get("OPENAI_STYLIST_MODEL") ?? "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content:
          "You are a personal stylist. The user has selected one anchor clothing item and wants to know what to wear with it from their existing wardrobe. Suggest 2–4 complete outfit pairings using only the provided wardrobe items. Each pairing should list the item IDs to combine with the anchor item. Be specific about why they work together.",
      },
      {
        role: "user",
        content: JSON.stringify({
          anchorItem: simplifiedAnchor,
          wardrobeItems: simplifiedItems,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ai_pairings_suggestion",
        strict: true,
        schema: pairingsSchema(),
      },
    },
  });

  const outputText = getOpenAiOutputText(openAiPayload);

  if (!outputText) {
    throw new Error("OpenAI did not return pairing suggestions.");
  }

  return JSON.parse(outputText);
}

async function generateOutfit(body: {
  occasion: string;
  weather: WeatherSnapshot;
  profile: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
}) {
  const simplifiedItems = body.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    colours: item.colours,
    occasions: item.occasions,
    formality: item.formality,
    material: item.material,
    favorite: item.favorite,
    aiSummary: item.aiSummary ?? null,
  }));

  const openAiPayload = await callOpenAi({
    model: Deno.env.get("OPENAI_STYLIST_MODEL") ?? "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content:
          "You are a personal stylist for a wardrobe app. Recommend wearable outfits using only the provided wardrobe items. Prefer practical outfits, explain why they fit the moment, and never invent item ids.",
      },
      {
        role: "user",
        content: JSON.stringify({
          occasion: body.occasion,
          weather: body.weather,
          profile: body.profile,
          wardrobeItems: simplifiedItems,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ai_stylist_recommendation",
        strict: true,
        schema: stylistSchema(),
      },
    },
  });

  const outputText = getOpenAiOutputText(openAiPayload);

  if (!outputText) {
    throw new Error("OpenAI did not return stylist output.");
  }

  return JSON.parse(outputText);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await request.json();

    if (body.action === "analyze-item") {
      if (!body.imageUrl) {
        return jsonResponse(400, {
          error: "imageUrl is required for analyze-item.",
        });
      }

      const analysis = await analyzeItem({
        imageUrl: body.imageUrl as string,
        itemName: body.itemName as string | undefined,
      });

      return jsonResponse(200, analysis);
    }

    if (body.action === "generate-outfit") {
      const recommendation = await generateOutfit({
        occasion: body.occasion as string,
        weather: body.weather as WeatherSnapshot,
        profile: body.profile as Record<string, unknown>,
        items: body.items as Array<Record<string, unknown>>,
      });

      return jsonResponse(200, recommendation);
    }

    if (body.action === "suggest-pairings") {
      if (!body.anchorItem) {
        return jsonResponse(400, {
          error: "anchorItem is required for suggest-pairings.",
        });
      }

      const suggestion = await suggestPairings({
        anchorItem: body.anchorItem as Record<string, unknown>,
        wardrobeItems: (body.wardrobeItems ?? []) as Array<
          Record<string, unknown>
        >,
      });

      return jsonResponse(200, suggestion);
    }

    return jsonResponse(400, { error: "Unsupported action." });
  } catch (error) {
    return jsonResponse(500, {
      error:
        error instanceof Error
          ? error.message
          : "Unknown AI integration error.",
    });
  }
});
