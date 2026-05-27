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

const PRICING = {
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },
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

const ANALYSIS_PROMPT = `Sos un experto en marketing digital, quiz funnels y diseño UI/UX. Analiza las capturas de pantalla de un quiz funnel y devuelve JSON estructurado.

Para cada slide, identifica:
1. slide_type: "intro"|"question"|"prueba_social"|"result"|"offer"|"other"
2. question_text: texto principal
3. options: [{text, emoji, notes}]
4. decoration_type: "emojis"|"images"|"none"
5. notes: copywriting, psicologia, gatillos mentales
6. style_notes: DETALLADO - incluir:
   - Colores en HEX (fondo, texto, botones, acentos)
   - Tipografia: familia (sans-serif/serif/rounded), peso, tamaño
   - Layout: centrado/izquierda, padding/spacing
   - Botones: forma (pill/rounded/square), tamaño, colores, borde, sombra
   - Imagenes/iconos: tipo, tamaño, posicion
   - Barra de progreso: estilo y posicion
   - Espaciado entre elementos
   - Efecto visual: minimalista/colorido/profesional/juvenil

Ademas:
- funnel_style_notes: SUPER DETALLADO:
  * Palette completa (HEX): primario, secundario, fondo, texto, acentos
  * Tipografia (familia, pesos, jerarquia tamaños)
  * Botones/opciones (border-radius px, padding, colores, shadows)
  * Cards/contenedores si hay
  * Spacing general (tight/normal/spacious)
  * Animaciones/transiciones detectadas
  * Progress bar (color, posicion, estilo)
  * Mobile-first? responsive?
  * Decorativos (gradients, shadows, borders, iconos)
  * Feeling/vibe: confianza, urgencia, salud, lujo, casual, etc.
- total_questions: cantidad de preguntas
- ad_copy_insights: ganchos, emociones, patrones, CTA style, tone of voice

RESPONDE SOLO JSON valido, sin markdown ni backticks:
{"slides":[{"slide_type":"...","question_text":"...","options":[...],"decoration_type":"...","notes":"...","style_notes":"..."}],"funnel_style_notes":"...","total_questions":N,"ad_copy_insights":"..."}`

function timestamp(): string { return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }
function log(emoji: string, msg: string) { console.log(`[${timestamp()}] [ai] ${emoji} ${msg}`) }
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function analyzeWithGemini(
  screenshots: { base64: string; text: string; html: string }[],
  options?: { maxRetries?: number; timeoutMs?: number }
): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY")

  const maxRetries = options?.maxRetries ?? 3
  const timeoutMs = options?.timeoutMs ?? 180_000

  log("🤖", `OpenAI (${MODEL}) - ${screenshots.length} slides`)
  log("⚙️", `maxRetries=${maxRetries}, timeout=${timeoutMs / 1000}s`)

  const openai = new OpenAI({ apiKey, timeout: timeoutMs })
  const content: any[] = [{ type: "text", text: ANALYSIS_PROMPT + "\n\n" + screenshots.length + " slides:" }]

  for (let i = 0; i < screenshots.length; i++) {
    const s = screenshots[i]
    content.push({ type: "text", text: `\n--- SLIDE ${i + 1} ---\nTexto: ${s.text.slice(0, 800)}\nInteractivos: ${s.html.slice(0, 400)}` })
    content.push({ type: "image_url", image_url: { url: "data:image/png;base64," + s.base64, detail: "low" } })
  }

  const textChars = content.reduce((acc: number, c: any) => acc + (c.type === "text" ? c.text.length : 0), 0)
  const estimatedTextTokens = Math.ceil(textChars / 4)
  const imageTokens = screenshots.length * 85
  const estimatedInputTokens = estimatedTextTokens + imageTokens
  const estimatedCost = calculateCost(MODEL, estimatedInputTokens, 3000)

  log("📊", `Tokens estimados: ~${estimatedInputTokens.toLocaleString()} input (${estimatedTextTokens.toLocaleString()} texto + ${imageTokens} imgs)`)
  log("💰", `Costo estimado: ~$${estimatedCost.total_cost_usd.toFixed(4)} USD`)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log("🔄", `Intento ${attempt}/${maxRetries}...`)
      const startTime = Date.now()

      const response = await openai.chat.completions.create({
        model: MODEL, messages: [{ role: "user", content }], max_tokens: 8192, temperature: 0.3,
      })

      const elapsed = (Date.now() - startTime) / 1000
      log("✅", `Respuesta en ${elapsed.toFixed(1)}s`)

      const usage = response.usage
      let costInfo: CostInfo
      if (usage) {
        const costs = calculateCost(MODEL, usage.prompt_tokens, usage.completion_tokens)
        costInfo = { model: MODEL, input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens, total_tokens: usage.total_tokens, ...costs, elapsed_seconds: elapsed }
        log("📊", `Tokens REALES: ${usage.prompt_tokens.toLocaleString()} in + ${usage.completion_tokens.toLocaleString()} out = ${usage.total_tokens.toLocaleString()}`)
        log("💰", `Costo REAL: $${costs.input_cost_usd.toFixed(4)} + $${costs.output_cost_usd.toFixed(4)} = $${costs.total_cost_usd.toFixed(4)} USD`)
        log("⏱️", `${Math.round(usage.completion_tokens / elapsed)} tokens/s`)
      } else {
        costInfo = { model: MODEL, input_tokens: estimatedInputTokens, output_tokens: 3000, total_tokens: estimatedInputTokens + 3000, ...estimatedCost, elapsed_seconds: elapsed }
      }

      const text = response.choices[0]?.message?.content || ""
      if (!text.trim()) throw new Error("Empty response")

      let jsonStr = text.trim()
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")

      try {
        const parsed = JSON.parse(jsonStr) as Omit<AnalysisResult, "cost">
        log("✅", `${parsed.slides.length} slides analizados, ${parsed.total_questions} preguntas`)
        return { ...parsed, cost: costInfo }
      } catch (parseError: any) {
        log("⚠️", `JSON invalido: ${parseError.message}`)
        if (attempt === maxRetries) throw new Error("Invalid JSON after all retries")
        lastError = parseError
      }
    } catch (error: any) {
      lastError = error
      const isTimeout = error.message?.includes("timeout") || error.code === "ETIMEDOUT"
      const isRateLimit = error.status === 429
      if (isTimeout) log("⏰", `Timeout intento ${attempt}`)
      else if (isRateLimit) log("🚫", `Rate limit intento ${attempt}`)
      else log("❌", `Error intento ${attempt}: ${error.message}`)
      if (attempt === maxRetries) throw lastError
      const waitTime = Math.min((isRateLimit ? 15000 : 5000) * Math.pow(2, attempt - 1), 60000)
      log("⏳", `Esperando ${(waitTime / 1000).toFixed(0)}s...`)
      await sleep(waitTime)
    }
  }
  throw lastError || new Error("Unknown error")
}
