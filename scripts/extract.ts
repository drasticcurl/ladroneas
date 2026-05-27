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
 * 
 * ENV VARS (en .env.local):
 *   EXTRACTOR_API_URL=https://tu-app.vercel.app  (o http://localhost:3000 para dev)
 */

import puppeteer from "puppeteer"

const API_URL = process.env.EXTRACTOR_API_URL || "http://localhost:3000"

interface ExtractedSlide {
  base64: string
  text: string
  html: string
}

async function extractQuizFunnel(url: string, maxSlides = 20): Promise<ExtractedSlide[]> {
  console.log("🚀 Abriendo Chrome...")
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 390, height: 844 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const slides: ExtractedSlide[] = []

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    )

    console.log("🌐 Navegando a: " + url)
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))

    let previousHtml = ""
    let stuckCount = 0

    for (let i = 0; i < maxSlides; i++) {
      await new Promise((r) => setTimeout(r, 1500))

      const currentHtml = await page.evaluate(() => document.body.innerHTML)
      if (currentHtml === previousHtml) {
        stuckCount++
        if (stuckCount >= 2) { console.log("⏹️  Sin cambios. Terminando."); break }
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

      slides.push({ base64: screenshot as string, text: pageText, html: pageHtml })
      console.log("📸 Slide " + (i + 1) + " capturado (" + pageText.slice(0, 50).replace(/\n/g, " ") + "...)")

      // Intentar avanzar al siguiente slide
      const clicked = await tryClickNext(page)
      if (!clicked) { console.log("⏹️  No hay mas elementos clickeables. Terminando."); break }
      await new Promise((r) => setTimeout(r, 2000))
    }

    return slides
  } finally {
    await browser.close()
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

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error("❌ Uso: npx tsx scripts/extract.ts <url-del-quiz-funnel>")
    process.exit(1)
  }

  console.log("\n🔍 EXTRACTOR 123")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("URL: " + url)
  console.log("API: " + API_URL)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  // 1. Scrapear localmente
  const slides = await extractQuizFunnel(url)
  console.log("\n✅ " + slides.length + " slides capturados")

  // 2. Mandar al API para analisis con Gemini
  console.log("\n🤖 Enviando al API para analisis con Gemini...")
  const response = await fetch(API_URL + "/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, screenshots: slides }),
  })

  if (!response.ok) {
    const err = await response.json()
    console.error("❌ Error del API: " + err.error)
    process.exit(1)
  }

  const result = await response.json()

  console.log("\n✅ Analisis completo!")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("📊 " + result.slides_extracted + " slides analizados")
  console.log("❓ " + result.total_questions + " preguntas detectadas")
  console.log("🎨 " + (result.funnel_style_notes || "").slice(0, 80) + "...")
  console.log("✍️  " + (result.ad_copy_insights || "").slice(0, 80) + "...")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  // 3. Guardar en la DB
  console.log("💾 Guardando en la base de datos...")
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
  }

  console.log("\n🎉 Listo! Funnel guardado: " + funnel.id)
  console.log("👉 Ver en: " + API_URL + "/funnel/" + funnel.id + "\n")
}

main().catch((e) => { console.error("❌ Error:", e.message); process.exit(1) })
