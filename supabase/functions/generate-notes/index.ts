// supabase/functions/generate-notes/index.ts
// Uses Google Gemini 1.5 Flash (free tier) via REST API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in response: " + cleaned.slice(0, 200))
  }
  return cleaned.slice(start, end + 1)
}

async function callGemini(
  prompt: string,
  geminiApiKey: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${text}`)
  }

  const data = await response.json()
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  console.log("Gemini raw response:", rawText.slice(0, 500))
  return rawText
}

async function generateWithRetry(
  rawNotes: string,
  englishLevel: string,
  geminiApiKey: string,
): Promise<unknown> {
  const prompt = `${SYSTEM_PROMPT(englishLevel)}\n\nStudent notes:\n${rawNotes}`

  const rawText1 = await callGemini(prompt, geminiApiKey)
  try {
    return JSON.parse(extractJSON(rawText1))
  } catch (_e) {
    console.warn("First parse failed, retrying with repair prompt…")
    const repairPrompt = `${prompt}\n\nYour previous output was not valid JSON. Reply with ONLY the JSON object, starting with { and ending with }.`
    const rawText2 = await callGemini(repairPrompt, geminiApiKey)
    return JSON.parse(extractJSON(rawText2))
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
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

    const generated_content = await generateWithRetry(rawNotes, englishLevel, geminiApiKey)

    return new Response(
      JSON.stringify({ generated_content, noteSetId }),
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
