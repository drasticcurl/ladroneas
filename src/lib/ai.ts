import OpenAI from "openai"

export interface AnalyzedSlide {
  slide_type: "question" | "intro" | "result" | "offer" | "prueba_social" | "other"
  question_text: string | null
  options: { text: string; emoji?: string; image_url?: string; notes?: string }[]
  decoration_type: "emojis" | "images" | "none"
  notes: string | null
  style_notes: string | null
}

export interface AnalysisResult {
  slides: AnalyzedSlide[]
  funnel_style_notes: string
  total_questions: number
  ad_copy_insights: string
}

const ANALYSIS_PROMPT = `Sos un experto en marketing digital y quiz funnels. Analiza las siguientes capturas de pantalla de un quiz funnel (paso a paso) y devuelve un analisis estructurado en JSON.

Para cada slide/pantalla, identifica:
1. slide_type: "intro" (primera pantalla/headline), "question" (pregunta con opciones), "prueba_social" (testimonios, reviews, logos de medios), "result" (resultado del quiz), "offer" (oferta/venta), "other" (cualquier otra cosa)
2. question_text: El texto principal de la pregunta o titulo del slide
3. options: Array de opciones de respuesta. Cada una con "text" (texto), "emoji" (si tiene emoji al lado), "notes" (observaciones)
4. decoration_type: "emojis" si las opciones tienen emojis, "images" si tienen imagenes al costado, "none" si son solo texto
5. notes: Observaciones sobre copywriting, psicologia, gatillos mentales usados
6. style_notes: Observaciones sobre diseno (colores, tipografia, layout, spacing)

Ademas incluir:
- funnel_style_notes: Descripcion general del estilo visual del funnel completo
- total_questions: Cantidad de slides que son preguntas
- ad_copy_insights: Insights sobre el copywriting general del funnel (ganchos, emociones, patrones)

IMPORTANTE: Responde SOLO con JSON valido, sin markdown, sin backticks. El formato exacto es:
{
  "slides": [{ "slide_type": "...", "question_text": "...", "options": [...], "decoration_type": "...", "notes": "...", "style_notes": "..." }],
  "funnel_style_notes": "...",
  "total_questions": N,
  "ad_copy_insights": "..."
}`

export async function analyzeWithGemini(screenshots: { base64: string; text: string; html: string }[]): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY")

  console.log("[ai] 🤖 Conectando con OpenAI (gpt-4.1-mini)...")
  const openai = new OpenAI({ apiKey })

  const content: any[] = [{ type: "text", text: ANALYSIS_PROMPT + "\n\nAqui estan los " + screenshots.length + " slides del funnel:" }]

  for (let i = 0; i < screenshots.length; i++) {
    const s = screenshots[i]
    content.push({ type: "text", text: "\n--- SLIDE " + (i + 1) + " ---\nTexto visible: " + s.text.slice(0, 800) + "\nElementos interactivos: " + s.html.slice(0, 400) })
    content.push({ type: "image_url", image_url: { url: "data:image/png;base64," + s.base64, detail: "low" } })
  }

  console.log("[ai] 📤 Enviando " + screenshots.length + " slides con screenshots...")
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content }],
    max_tokens: 4096,
    temperature: 0.3,
  })
  console.log("[ai] ✅ Respuesta recibida de OpenAI")

  const text = response.choices[0]?.message?.content || ""

  let jsonStr = text.trim()
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    const parsed = JSON.parse(jsonStr) as AnalysisResult
    console.log("[ai] ✅ JSON parseado: " + parsed.slides.length + " slides analizados")
    return parsed
  } catch (e) {
    console.error("[ai] ❌ Error parseando JSON:", jsonStr.slice(0, 300))
    throw new Error("OpenAI returned invalid JSON")
  }
}
