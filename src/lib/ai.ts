import OpenAI from "openai"

export interface AnalyzedSlide {
  slide_type: "question" | "intro" | "result" | "offer" | "prueba_social" | "other"
  question_text: string | null
  options: { text: string; emoji?: string; image_url?: string; notes?: string }[]
  decoration_type: "emojis" | "images" | "none"
  notes: string | null
  style_notes: string | null
}

export interface CostInfo {
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_cost_usd: number
  output_cost_usd: number
  total_cost_usd: number
  elapsed_seconds: number
}

export interface AnalysisResult {
  slides: AnalyzedSlide[]
  funnel_style_notes: string
  total_questions: number
  ad_copy_insights: string
  cost: CostInfo
}

// Precios por 1M tokens (gpt-4.1-mini, mayo 2025)
const PRICING = {
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },   // $0.40/1M input, $1.60/1M output
  "gpt-4.1": { input: 2.00, output: 8.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
} as const

const MODEL = "gpt-4.1-mini"

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING["gpt-4.1-mini"]
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return { input_cost_usd: inputCost, output_cost_usd: outputCost, total_cost_usd: inputCost + outputCost }
}

const ANALYSIS_PROMPT = `Sos un experto en marketing digital, quiz funnels y diseño UI/UX. Analiza las siguientes capturas de pantalla de un quiz funnel (paso a paso) y devuelve un analisis estructurado en JSON.

Para cada slide/pantalla, identifica:
1. slide_type: "intro" (primera pantalla/headline), "question" (pregunta con opciones), "prueba_social" (testimonios, reviews, logos de medios), "result" (resultado del quiz), "offer" (oferta/venta), "other" (cualquier otra cosa)
2. question_text: El texto principal de la pregunta o titulo del slide
3. options: Array de opciones de respuesta. Cada una con "text" (texto), "emoji" (si tiene emoji al lado), "notes" (observaciones)
4. decoration_type: "emojis" si las opciones tienen emojis, "images" si tienen imagenes al costado, "none" si son solo texto
5. notes: Observaciones sobre copywriting, psicologia, gatillos mentales usados
6. style_notes: Analisis DETALLADO de diseño visual. DEBE incluir TODOS estos puntos:
   - Colores principales en HEX (fondo, texto, botones, acentos)
   - Tipografia: familia aproximada (sans-serif/serif/rounded), peso (bold/regular/light), tamaño relativo (grande/mediano/chico)
   - Layout: centrado/izquierda, padding/spacing (amplio/compacto/ajustado)
   - Botones/opciones: forma (redondeado/pill/cuadrado), tamaño, color de fondo y texto, borde, sombra
   - Imagenes: si usa iconos/ilustraciones/fotos, tamaño relativo, posicion
   - Progreso: si hay barra de progreso, su estilo y posicion
   - Espaciado entre elementos (mucho/poco/moderado)
   - Efecto visual general: minimalista, colorido, profesional, juvenil, corporativo, etc.

Ademas incluir:
- funnel_style_notes: Descripcion MUY DETALLADA del estilo visual del funnel completo. Incluir:
  * Palette de colores completa (HEX): primario, secundario, fondo, texto, acentos
  * Tipografia general (familia, pesos usados, jerarquia de tamaños)
  * Estilo de botones/opciones (border-radius en px aprox, padding, colores)
  * Estilo de cards/contenedores si hay
  * Espaciado general (tight/normal/spacious)
  * Animaciones/transiciones si se detectan
  * Barra de progreso (color, posicion, estilo)
  * Responsive behavior (es mobile-first? como se adapta?)
  * Elementos decorativos (gradients, shadows, borders, iconos)
  * Feeling general: que vibe transmite (confianza, urgencia, salud, lujo, casual, etc.)
- total_questions: Cantidad de slides que son preguntas
- ad_copy_insights: Insights sobre el copywriting general del funnel (ganchos, emociones, patrones, CTA style, tone of voice)

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
  const timeoutMs = options?.timeoutMs ?? 180_000 // 3 minutos default (más tiempo para prompts largos)

  log("🤖", `Conectando con OpenAI (${MODEL}) - ${screenshots.length} slides`)
  log("⚙️", `Config: maxRetries=${maxRetries}, timeout=${timeoutMs / 1000}s`)

  const openai = new OpenAI({ apiKey, timeout: timeoutMs })

  const content: any[] = [{ type: "text", text: ANALYSIS_PROMPT + "\n\nAqui estan los " + screenshots.length + " slides del funnel:" }]

  for (let i = 0; i < screenshots.length; i++) {
    const s = screenshots[i]
    content.push({ type: "text", text: "\n--- SLIDE " + (i + 1) + " ---\nTexto visible: " + s.text.slice(0, 800) + "\nElementos interactivos: " + s.html.slice(0, 400) })
    content.push({ type: "image_url", image_url: { url: "data:image/png;base64," + s.base64, detail: "low" } })
  }

  // Estimación de tokens pre-request
  // low detail images = 85 tokens cada una
  // texto ~4 chars per token
  const textChars = content.reduce((acc, c) => acc + (c.type === "text" ? c.text.length : 0), 0)
  const estimatedTextTokens = Math.ceil(textChars / 4)
  const imageTokens = screenshots.length * 85
  const estimatedInputTokens = estimatedTextTokens + imageTokens

  log("📤", `Payload armado: ${screenshots.length} slides con screenshots`)
  log("📊", `Tokens estimados: ~${estimatedInputTokens.toLocaleString()} input (${estimatedTextTokens.toLocaleString()} texto + ${imageTokens} imgs)`)
  
  const estimatedCost = calculateCost(MODEL, estimatedInputTokens, 2000) // asumimos ~2k output
  log("💰", `Costo estimado: ~$${estimatedCost.total_cost_usd.toFixed(4)} USD`)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log("🔄", `Intento ${attempt}/${maxRetries} - Enviando a OpenAI...`)
      const startTime = Date.now()

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content }],
        max_tokens: 8192,
        temperature: 0.3,
      })

      const elapsed = (Date.now() - startTime) / 1000
      log("✅", `Respuesta recibida en ${elapsed.toFixed(1)}s (intento ${attempt})`)

      // Calcular costo real
      const usage = response.usage
      let costInfo: CostInfo

      if (usage) {
        const costs = calculateCost(MODEL, usage.prompt_tokens, usage.completion_tokens)
        costInfo = {
          model: MODEL,
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          ...costs,
          elapsed_seconds: elapsed,
        }
        
        log("📊", `Tokens REALES: ${usage.prompt_tokens.toLocaleString()} input + ${usage.completion_tokens.toLocaleString()} output = ${usage.total_tokens.toLocaleString()} total`)
        log("💰", `Costo REAL: $${costs.input_cost_usd.toFixed(4)} input + $${costs.output_cost_usd.toFixed(4)} output = $${costs.total_cost_usd.toFixed(4)} USD`)
        log("⏱️", `Velocidad: ${Math.round(usage.completion_tokens / elapsed)} tokens/s`)
      } else {
        costInfo = {
          model: MODEL,
          input_tokens: estimatedInputTokens,
          output_tokens: 2000,
          total_tokens: estimatedInputTokens + 2000,
          ...estimatedCost,
          elapsed_seconds: elapsed,
        }
        log("⚠️", "No se recibió usage info, usando estimaciones")
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
        const parsed = JSON.parse(jsonStr) as Omit<AnalysisResult, "cost">
        log("✅", `JSON parseado: ${parsed.slides.length} slides analizados, ${parsed.total_questions} preguntas`)
        return { ...parsed, cost: costInfo }
      } catch (parseError: any) {
        log("⚠️", `JSON invalido en intento ${attempt}: ${parseError.message}`)
        log("📝", `Respuesta (primeros 200 chars): ${jsonStr.slice(0, 200)}`)
        
        if (attempt === maxRetries) {
          throw new Error("OpenAI returned invalid JSON after all retries")
        }
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

      const baseWait = isRateLimit ? 15000 : 5000
      const waitTime = Math.min(baseWait * Math.pow(2, attempt - 1), 60000)
      log("⏳", `Esperando ${(waitTime / 1000).toFixed(0)}s antes de reintentar...`)
      await sleep(waitTime)
    }
  }

  throw lastError || new Error("Unknown error in analyzeWithGemini")
}
