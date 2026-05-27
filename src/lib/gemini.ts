import { GoogleGenerativeAI } from "@google/generative-ai"
import { ExtractedSlide } from "./extractor"

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

Ademas, al final inclui:
- funnel_style_notes: Descripcion general del estilo visual del funnel completo
- total_questions: Cantidad de slides que son preguntas
- ad_copy_insights: Insights sobre el copywriting general del funnel

IMPORTANTE: Responde SOLO con JSON valido, sin markdown, sin backticks, sin explicaciones. El formato exacto es:
{
  "slides": [...],
  "funnel_style_notes": "...",
  "total_questions": N,
  "ad_copy_insights": "..."
}`

export async function analyzeWithGemini(slides: ExtractedSlide[]): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY")

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

  const parts: any[] = [{ text: ANALYSIS_PROMPT + "\n\nAqui estan los slides del funnel:\n" }]

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    parts.push({ text: "\n--- SLIDE " + (i + 1) + " ---\nTexto visible:\n" + slide.page_text.slice(0, 1000) + "\n\nElementos interactivos:\n" + slide.page_html.slice(0, 500) + "\n\nScreenshot:" })
    parts.push({ inlineData: { mimeType: "image/png", data: slide.screenshot_base64 } })
  }

  const result = await model.generateContent(parts)
  const response = result.response
  const text = response.text()

  let jsonStr = text.trim()
  if (jsonStr.startsWith("\`\`\`")) {
    jsonStr = jsonStr.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "")
  }

  try {
    return JSON.parse(jsonStr) as AnalysisResult
  } catch (e) {
    console.error("Failed to parse Gemini response:", jsonStr.slice(0, 500))
    throw new Error("Gemini returned invalid JSON")
  }
}
