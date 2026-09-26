// supabase/functions/generate-notes/index.ts
// Deno-compatible Edge Function using HF Router (OpenAI-compatible chat completions)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const HF_API_URL =
  "https://router.huggingface.co/hf-inference/v1/chat/completions"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SYSTEM_PROMPT = (englishLevel: string) =>
  `You convert raw study notes into memorization aids.
Input notes are written by a student at ${englishLevel} English level — match your output vocabulary to that level.
Return ONLY valid JSON, no markdown fences, no preamble, no explanation before or after, in this exact shape:
{"flashcards":[{"question":"string","answer":"string"}],"story":"a short mnemonic story (150-250 words)"}
Generate between 5 and 10 flashcards depending on content density.
Do not invent facts not present in the input notes.
Respond with the JSON object and nothing else.`

function extractJSON(text: string): string {
  // Strip markdown fences
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in response: " + cleaned.slice(0, 200))
  }
  return cleaned.slice(start, end + 1)
}

async function callHF(
  messages: { role: string; content: string }[],
  hfApiKey: string,
): Promise<{ rawText: string; warmingUp: boolean }> {
  const body = JSON.stringify({
    model: "HuggingFaceH4/zephyr-7b-beta",
    messages,
    max_tokens: 1024,
    temperature: 0.4,
  })

  let warmingUp = false
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfApiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  // Handle 503 cold start
  if (response.status === 503) {
    const errBody = await response.json().catch(() => ({}))
    const estimatedTime = Math.min(errBody?.estimated_time ?? 20, 20)
    console.log(`HF model loading, waiting ${estimatedTime}s…`)
    warmingUp = true
    await new Promise((r) => setTimeout(r, estimatedTime * 1000))

    const retryController = new AbortController()
    const retryTimeout = setTimeout(() => retryController.abort(), 30_000)
    try {
      response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: retryController.signal,
      })
    } finally {
      clearTimeout(retryTimeout)
    }
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HF API error ${response.status}: ${text}`)
  }

  const data = await response.json()
  // OpenAI-compatible response shape
  const rawText: string = data?.choices?.[0]?.message?.content ?? JSON.stringify(data)

  console.log("HF raw response:", rawText.slice(0, 500))

  return { rawText, warmingUp }
}

async function generateWithRetry(
  rawNotes: string,
  englishLevel: string,
  hfApiKey: string,
): Promise<{ generated_content: unknown; warmingUp: boolean }> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT(englishLevel) },
    { role: "user", content: `Student notes:\n${rawNotes}` },
  ]

  const { rawText: rawText1, warmingUp } = await callHF(messages, hfApiKey)

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJSON(rawText1))
  } catch (_e) {
    console.warn("First parse failed, retrying with repair prompt…")
    const repairMessages = [
      ...messages,
      { role: "assistant", content: rawText1 },
      {
        role: "user",
        content:
          "Your previous output was not valid JSON. Reply with ONLY the JSON object, starting with { and ending with }.",
      },
    ]
    const { rawText: rawText2 } = await callHF(repairMessages, hfApiKey)
    parsed = JSON.parse(extractJSON(rawText2))
  }

  return { generated_content: parsed, warmingUp }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const hfApiKey = Deno.env.get("HF_API_KEY")
    if (!hfApiKey) {
      return new Response(JSON.stringify({ error: "HF_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { noteSetId, rawNotes, englishLevel } = await req.json()

    if (!rawNotes || !englishLevel) {
      return new Response(
        JSON.stringify({ error: "rawNotes and englishLevel are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { generated_content, warmingUp } = await generateWithRetry(
      rawNotes,
      englishLevel,
      hfApiKey,
    )

    return new Response(
      JSON.stringify({ generated_content, warmingUp, noteSetId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    console.error("Edge function error:", err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
