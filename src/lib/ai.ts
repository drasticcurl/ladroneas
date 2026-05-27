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

function timestamp(): string {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function log(emoji: string, msg: string) {
  console.log(`[${timestamp()}] [ai] ${emoji} ${msg}`)
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function analyzeWithGemini(
  screenshots: { base64: string; text: string; html: string }[],
  options?: { maxRetries?: number; timeoutMs?: number }
): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY")

  const maxRetries = options?.maxRetries ?? 3
  const timeoutMs = options?.timeoutMs ?? 120_000 // 2 minutos default

  log("🤖", `Conectando con OpenAI (gpt-4.1-mini) - ${screenshots.length} slides`)
  log("⚙️", `Config: maxRetries=${maxRetries}, timeout=${timeoutMs / 1000}s`)

  const openai = new OpenAI({ apiKey, timeout: timeoutMs })

  const content: any[] = [{ type: "text", text: ANALYSIS_PROMPT + "\n\nAqui estan los " + screenshots.length + " slides del funnel:" }]

  for (let i = 0; i < screenshots.length; i++) {
    const s = screenshots[i]
    content.push({ type: "text", text: "\n--- SLIDE " + (i + 1) + " ---\nTexto visible: " + s.text.slice(0, 800) + "\nElementos interactivos: " + s.html.slice(0, 400) })
    content.push({ type: "image_url", image_url: { url: "data:image/png;base64," + s.base64, detail: "low" } })
  }

  log("📤", `Payload armado: ${screenshots.length} slides con screenshots`)
  log("📏", `Tamaño estimado del request: ~${Math.round(content.reduce((acc, c) => acc + JSON.stringify(c).length, 0) / 1024)}KB`)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log("🔄", `Intento ${attempt}/${maxRetries} - Enviando a OpenAI...`)
      const startTime = Date.now()

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content }],
        max_tokens: 4096,
        temperature: 0.3,
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      log("✅", `Respuesta recibida de OpenAI en ${elapsed}s (intento ${attempt})`)

      // Log usage info if available
      if (response.usage) {
        log("📊", `Tokens: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`)
      }

      const text = response.choices[0]?.message?.content || ""

      if (!text.trim()) {
        throw new Error("OpenAI returned empty response")
      }

      let jsonStr = text.trim()
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
      }

      try {
        const parsed = JSON.parse(jsonStr) as AnalysisResult
        log("✅", `JSON parseado exitosamente: ${parsed.slides.length} slides analizados`)
        log("📊", `Resumen: ${parsed.total_questions} preguntas, estilo: ${(parsed.funnel_style_notes || "").slice(0, 60)}...`)
        return parsed
      } catch (parseError: any) {
        log("⚠️", `JSON invalido en intento ${attempt}: ${parseError.message}`)
        log("📝", `Respuesta (primeros 200 chars): ${jsonStr.slice(0, 200)}`)
        
        if (attempt === maxRetries) {
          throw new Error("OpenAI returned invalid JSON after all retries")
        }
        // Reintentar - a veces el modelo devuelve JSON malformado
        lastError = parseError
      }
    } catch (error: any) {
      lastError = error

      const isTimeout = error.code === "ETIMEDOUT" || error.message?.includes("timeout") || error.message?.includes("Timeout")
      const isRateLimit = error.status === 429
      const isServerError = error.status >= 500

      if (isTimeout) {
        log("⏰", `Timeout en intento ${attempt}/${maxRetries} (>${timeoutMs / 1000}s)`)
      } else if (isRateLimit) {
        log("🚫", `Rate limit en intento ${attempt}/${maxRetries}`)
      } else if (isServerError) {
        log("💥", `Error del servidor (${error.status}) en intento ${attempt}/${maxRetries}`)
      } else {
        log("❌", `Error en intento ${attempt}/${maxRetries}: ${error.message}`)
      }

      if (attempt === maxRetries) {
        log("💀", `Fallaron todos los ${maxRetries} intentos`)
        throw lastError
      }

      // Backoff exponencial
      const baseWait = isRateLimit ? 15000 : 5000
      const waitTime = Math.min(baseWait * Math.pow(2, attempt - 1), 60000)
      log("⏳", `Esperando ${(waitTime / 1000).toFixed(0)}s antes de reintentar...`)
      await sleep(waitTime)
    }
  }

  // Nunca deberia llegar aca, pero por si acaso
  throw lastError || new Error("Unknown error in analyzeWithGemini")
}
