/**
 * EXTRACTOR LOCAL - Corre en tu PC
 * 
 * Navega un quiz funnel con Chrome, captura screenshots de cada slide,
 * manda todo al API en Vercel donde Gemini lo analiza, y guarda el resultado en la DB.
 * 
 * SETUP (una sola vez):
 *   npm install -D puppeteer tsx
 * 
 * USO:
 *   npx tsx scripts/extract.ts "https://quiz-funnel-url.com"
 *   npx tsx scripts/extract.ts --from-cache <cache-dir>   # reusar capturas previas
 * 
 * ENV VARS (en .env.local):
 *   EXTRACTOR_API_URL=https://tu-app.vercel.app  (o http://localhost:3000 para dev)
 */

import puppeteer from "puppeteer"
import fs from "fs"
import path from "path"

const API_URL = process.env.EXTRACTOR_API_URL || "http://localhost:3000"

interface ExtractedSlide {
  base64: string
  text: string
  html: string
}

function timestamp(): string {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function log(emoji: string, msg: string) {
  console.log(`[${timestamp()}] ${emoji} ${msg}`)
}

function createCacheDir(url: string): string {
  const slug = url.replace(/https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80)
  const dir = path.join(process.cwd(), ".cache", slug + "_" + Date.now())
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function saveSlideToDisk(cacheDir: string, index: number, slide: ExtractedSlide) {
  const slideDir = path.join(cacheDir, `slide_${String(index + 1).padStart(2, "0")}`)
  fs.mkdirSync(slideDir, { recursive: true })
  
  // Guardar screenshot como PNG
  fs.writeFileSync(path.join(slideDir, "screenshot.png"), Buffer.from(slide.base64, "base64"))
  // Guardar texto
  fs.writeFileSync(path.join(slideDir, "text.txt"), slide.text)
  // Guardar HTML de elementos
  fs.writeFileSync(path.join(slideDir, "elements.html"), slide.html)
  // Guardar metadata JSON (sin base64 para que sea legible)
  fs.writeFileSync(path.join(slideDir, "meta.json"), JSON.stringify({ index: index + 1, textPreview: slide.text.slice(0, 200) }, null, 2))
}

function loadSlidesFromCache(cacheDir: string): ExtractedSlide[] {
  const slides: ExtractedSlide[] = []
  const entries = fs.readdirSync(cacheDir).filter(f => f.startsWith("slide_")).sort()
  
  for (const entry of entries) {
    const slideDir = path.join(cacheDir, entry)
    const screenshotPath = path.join(slideDir, "screenshot.png")
    const textPath = path.join(slideDir, "text.txt")
    const htmlPath = path.join(slideDir, "elements.html")
    
    if (!fs.existsSync(screenshotPath)) continue
    
    slides.push({
      base64: fs.readFileSync(screenshotPath).toString("base64"),
      text: fs.existsSync(textPath) ? fs.readFileSync(textPath, "utf-8") : "",
      html: fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf-8") : "",
    })
  }
  
  return slides
}

async function extractQuizFunnel(url: string, cacheDir: string, maxSlides = 20): Promise<ExtractedSlide[]> {
  log("🚀", "Abriendo Chrome...")
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 390, height: 844 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
  log("✅", "Chrome abierto")

  const slides: ExtractedSlide[] = []

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    )

    log("🌐", "Navegando a: " + url)
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
    log("✅", "Pagina cargada")
    await new Promise((r) => setTimeout(r, 2000))

    let previousHtml = ""
    let stuckCount = 0

    for (let i = 0; i < maxSlides; i++) {
      await new Promise((r) => setTimeout(r, 1500))

      const currentHtml = await page.evaluate(() => document.body.innerHTML)
      if (currentHtml === previousHtml) {
        stuckCount++
        if (stuckCount >= 2) { log("⏹️", "Sin cambios detectados. Terminando."); break }
      } else { stuckCount = 0 }
      previousHtml = currentHtml

      const screenshot = await page.screenshot({ encoding: "base64", type: "png" })

      const pageText = await page.evaluate(() => {
        const getText = (el: Element): string => {
          if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return ""
          if (el.children.length === 0) return el.textContent?.trim() || ""
          return Array.from(el.children).map(getText).filter(Boolean).join("\n")
        }
        return getText(document.body)
      })

      const pageHtml = await page.evaluate(() => {
        const elements: string[] = []
        document.querySelectorAll("button, [role='button'], input, a, [data-option], [class*='option'], [class*='answer'], [class*='choice']").forEach((el) => {
          const text = el.textContent?.trim() || ""
          if (text && text.length < 200) elements.push("<" + el.tagName.toLowerCase() + ">" + text + "</" + el.tagName.toLowerCase() + ">")
        })
        return elements.join("\n")
      })

      const slide: ExtractedSlide = { base64: screenshot as string, text: pageText, html: pageHtml }
      slides.push(slide)

      // Guardar en disco inmediatamente
      saveSlideToDisk(cacheDir, i, slide)
      log("📸", `Slide ${i + 1}/${maxSlides} capturado y guardado → ${pageText.slice(0, 50).replace(/\n/g, " ")}...`)

      // Intentar avanzar al siguiente slide
      const clicked = await tryClickNext(page)
      if (!clicked) { log("⏹️", "No hay mas elementos clickeables. Terminando."); break }
      log("👆", "Click realizado, esperando transicion...")
      await new Promise((r) => setTimeout(r, 2000))
    }

    return slides
  } catch (error: any) {
    log("❌", `Error durante scraping: ${error.message}`)
    if (slides.length > 0) {
      log("💾", `Se guardaron ${slides.length} slides en cache antes del error`)
      log("💡", `Podes reintentar con: npx tsx scripts/extract.ts --from-cache "${cacheDir}"`)
    }
    throw error
  } finally {
    await browser.close()
    log("🔒", "Chrome cerrado")
  }
}

async function tryClickNext(page: any): Promise<boolean> {
  const selectors = [
    "[data-option]", "[class*='option']:not([class*='selected'])",
    "[class*='answer']:not([class*='selected'])", "[class*='choice']:not([class*='selected'])",
    "[class*='quiz'] button", "[class*='question'] button",
    "button:not([type='submit']):not([disabled])",
    "[class*='next']", "[class*='continue']", "[class*='submit']", "button[type='submit']",
    "a[class*='option']", "a[class*='answer']",
  ]

  for (const selector of selectors) {
    try {
      const elements = await page.$$(selector)
      if (elements.length > 0) {
        const target = elements[Math.floor(Math.random() * Math.min(elements.length, 4))]
        const isVisible = await target.evaluate((el: any) => {
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none"
        })
        if (isVisible) { await target.click(); return true }
      }
    } catch { continue }
  }
  return false
}

async function callApiWithRetry(url: string, body: any, maxRetries = 3): Promise<any> {
  const TIMEOUT_MS = 120_000 // 2 minutos timeout

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log("🔄", `Intento ${attempt}/${maxRetries} - Enviando al API...`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(`API error ${response.status}: ${err.error || JSON.stringify(err)}`)
      }

      const result = await response.json()
      log("✅", `API respondio correctamente en intento ${attempt}`)
      return result
    } catch (error: any) {
      const isTimeout = error.name === "AbortError"
      const isLastAttempt = attempt === maxRetries

      if (isTimeout) {
        log("⏰", `Timeout (${TIMEOUT_MS / 1000}s) en intento ${attempt}/${maxRetries}`)
      } else {
        log("❌", `Error en intento ${attempt}/${maxRetries}: ${error.message}`)
      }

      if (isLastAttempt) {
        throw new Error(`Fallaron todos los ${maxRetries} intentos. Ultimo error: ${error.message}`)
      }

      // Esperar antes de reintentar (backoff exponencial)
      const waitTime = Math.min(5000 * Math.pow(2, attempt - 1), 30000)
      log("⏳", `Esperando ${waitTime / 1000}s antes de reintentar...`)
      await new Promise(r => setTimeout(r, waitTime))
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  let slides: ExtractedSlide[]
  let url: string
  let cacheDir: string

  // Modo: reusar capturas de cache
  if (args[0] === "--from-cache") {
    cacheDir = args[1]
    if (!cacheDir || !fs.existsSync(cacheDir)) {
      console.error("❌ Cache dir no encontrado: " + cacheDir)
      process.exit(1)
    }
    
    log("📂", `Cargando slides desde cache: ${cacheDir}`)
    slides = loadSlidesFromCache(cacheDir)
    url = "from-cache"
    
    if (slides.length === 0) {
      console.error("❌ No se encontraron slides en el cache")
      process.exit(1)
    }
    log("✅", `${slides.length} slides cargados desde cache`)
  } else {
    // Modo normal: scrapear
    url = args[0]
    if (!url) {
      console.error("❌ Uso:")
      console.error("   npx tsx scripts/extract.ts <url-del-quiz-funnel>")
      console.error("   npx tsx scripts/extract.ts --from-cache <cache-dir>")
      process.exit(1)
    }

    console.log("\n🔍 EXTRACTOR")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("URL: " + url)
    console.log("API: " + API_URL)
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    cacheDir = createCacheDir(url)
    log("💾", `Cache dir: ${cacheDir}`)

    // 1. Scrapear localmente
    slides = await extractQuizFunnel(url, cacheDir)
    log("✅", `${slides.length} slides capturados y guardados en disco`)
    log("💡", `Si falla el analisis, podes reintentar con:`)
    log("💡", `npx tsx scripts/extract.ts --from-cache "${cacheDir}"`)
  }

  // 2. Mandar al API para analisis con retries
  console.log("")
  log("🤖", `Enviando ${slides.length} slides al API para analisis...`)
  
  const result = await callApiWithRetry(API_URL + "/api/extract", { url, screenshots: slides })

  console.log("\n✅ Analisis completo!")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("📊 " + result.slides_extracted + " slides analizados")
  console.log("❓ " + result.total_questions + " preguntas detectadas")
  console.log("🎨 " + (result.funnel_style_notes || "").slice(0, 80) + "...")
  console.log("✍️  " + (result.ad_copy_insights || "").slice(0, 80) + "...")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  // 3. Guardar en la DB
  log("💾", "Guardando en la base de datos...")
  const funnelRes = await fetch(API_URL + "/api/funnels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      landing_url: url, notes: result.ad_copy_insights,
      total_questions: result.total_questions, funnel_style_notes: result.funnel_style_notes,
      format: null, ad_url: null, screenshot_url: null, ad_copy: null, cta: null,
    }),
  })

  if (!funnelRes.ok) { console.error("❌ Error al guardar funnel"); process.exit(1) }
  const funnel = await funnelRes.json()
  log("✅", `Funnel creado: ${funnel.id}`)

  for (let i = 0; i < result.slides.length; i++) {
    const slide = result.slides[i]
    await fetch(API_URL + "/api/slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        funnel_id: funnel.id, slide_order: i + 1, slide_type: slide.slide_type,
        question_text: slide.question_text, options: slide.options || [],
        screenshot_url: null, decoration_type: slide.decoration_type || "none",
        notes: slide.notes, style_notes: slide.style_notes,
      }),
    })
    log("💾", `Slide ${i + 1}/${result.slides.length} guardado`)
  }

  console.log("\n🎉 Listo! Funnel guardado: " + funnel.id)
  console.log("👉 Ver en: " + API_URL + "/funnel/" + funnel.id + "\n")
  
  // Info del cache
  log("📂", `Screenshots guardados en: ${cacheDir}`)
}

main().catch((e) => { 
  log("❌", `Error fatal: ${e.message}`)
  process.exit(1) 
})
