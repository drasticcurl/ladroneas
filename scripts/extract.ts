/**
 * LOCAL EXTRACTOR SCRIPT
 * 
 * Corre en tu PC con Puppeteer (necesitas Chrome instalado).
 * Navega el quiz funnel, captura screenshots, y manda todo al API para que OpenAI lo analice.
 * 
 * USO:
 *   npx ts-node scripts/extract.ts "https://quiz-funnel-url.com"
 * 
 * O si tenés tsx instalado (más rápido):
 *   npx tsx scripts/extract.ts "https://quiz-funnel-url.com"
 * 
 * REQUISITOS:
 *   npm install -D puppeteer tsx
 *   (puppeteer full, no puppeteer-core — así viene con Chromium bundled)
 * 
 * ENV VARS (en .env.local o exportadas):
 *   EXTRACTOR_API_URL=http://localhost:3000  (o tu URL de Vercel)
 */

import puppeteer from "puppeteer"
import * as fs from "fs"
import * as path from "path"

interface ExtractedSlide {
  screenshot_base64: string
  page_text: string
  page_html: string
  url: string
}

const API_URL = process.env.EXTRACTOR_API_URL || "http://localhost:3000"

async function extractQuizFunnel(url: string, maxSlides = 20): Promise<ExtractedSlide[]> {
  console.log(`🚀 Launching browser...`)
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

    console.log(`🌐 Navigating to: ${url}`)
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
    await new Promise((r) => setTimeout(r, 2000))

    let previousHtml = ""
    let stuckCount = 0

    for (let i = 0; i < maxSlides; i++) {
      await new Promise((r) => setTimeout(r, 1500))

      const currentHtml = await page.evaluate(() => document.body.innerHTML)

      if (currentHtml === previousHtml) {
        stuckCount++
        if (stuckCount >= 2) {
          console.log(`⏹️  No more changes detected. Stopping.`)
          break
        }
      } else {
        stuckCount = 0
      }
      previousHtml = currentHtml

      // Screenshot
      const screenshot = await page.screenshot({ encoding: "base64", type: "png" })

      // Extract text
      const pageText = await page.evaluate(() => {
        const getText = (el: Element): string => {
          if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return ""
          if (el.children.length === 0) return el.textContent?.trim() || ""
          return Array.from(el.children).map(getText).filter(Boolean).join("\n")
        }
        return getText(document.body)
      })

      // Extract interactive elements
      const pageHtml = await page.evaluate(() => {
        const elements: string[] = []
        document
          .querySelectorAll(
            "button, [role='button'], input, a, [data-option], [class*='option'], [class*='answer'], [class*='choice']"
          )
          .forEach((el) => {
            const text = el.textContent?.trim() || ""
            if (text && text.length < 200) {
              elements.push(`<${el.tagName.toLowerCase()}>${text}</${el.tagName.toLowerCase()}>`)
            }
          })
        return elements.join("\n")
      })

      slides.push({
        screenshot_base64: screenshot as string,
        page_text: pageText,
        page_html: pageHtml,
        url: page.url(),
      })

      console.log(`📸 Slide ${i + 1} captured (${pageText.slice(0, 60).replace(/\n/g, " ")}...)`)

      // Try to advance
      const clicked = await tryClickNext(page)
      if (!clicked) {
        console.log(`⏹️  No clickable elements found. Stopping.`)
        break
      }

      await new Promise((r) => setTimeout(r, 2000))
    }

    return slides
  } finally {
    await browser.close()
  }
}

async function tryClickNext(page: puppeteer.Page): Promise<boolean> {
  const selectors = [
    "[data-option]",
    "[class*='option']:not([class*='selected'])",
    "[class*='answer']:not([class*='selected'])",
    "[class*='choice']:not([class*='selected'])",
    "[class*='quiz'] button",
    "[class*='question'] button",
    "button:not([type='submit']):not([disabled])",
    "[class*='next']",
    "[class*='continue']",
    "[class*='submit']",
    "button[type='submit']",
    "a[class*='option']",
    "a[class*='answer']",
  ]

  for (const selector of selectors) {
    try {
      const elements = await page.$$(selector)
      if (elements.length > 0) {
        const target = elements[Math.floor(Math.random() * Math.min(elements.length, 4))]
        const isVisible = await target.evaluate((el) => {
          const rect = el.getBoundingClientRect()
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(el).display !== "none"
          )
        })
        if (isVisible) {
          await target.click()
          return true
        }
      }
    } catch {
      continue
    }
  }
  return false
}

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error("❌ Usage: npx tsx scripts/extract.ts <quiz-funnel-url>")
    process.exit(1)
  }

  console.log(`\n🔍 EXTRACTOR 123 - Local Mode`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`URL: ${url}`)
  console.log(`API: ${API_URL}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  // Step 1: Extract slides locally
  const slides = await extractQuizFunnel(url)
  console.log(`\n✅ Extracted ${slides.length} slides locally`)

  // Step 2: Send to API for AI analysis
  console.log(`\n🤖 Sending to API for OpenAI analysis...`)
  const response = await fetch(`${API_URL}/api/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      screenshots: slides.map((s) => ({
        base64: s.screenshot_base64,
        text: s.page_text,
        html: s.page_html,
      })),
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    console.error(`❌ API Error: ${err.error}`)
    process.exit(1)
  }

  const result = await response.json()

  console.log(`\n✅ Analysis complete!`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📊 ${result.slides_extracted} slides analyzed`)
  console.log(`❓ ${result.total_questions} preguntas detectadas`)
  console.log(`🎨 Estilo: ${result.funnel_style_notes?.slice(0, 100)}...`)
  console.log(`✍️  Copy: ${result.ad_copy_insights?.slice(0, 100)}...`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  // Step 3: Save to DB via API
  console.log(`💾 Saving to database...`)
  const funnelRes = await fetch(`${API_URL}/api/funnels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      landing_url: url,
      notes: result.ad_copy_insights,
      total_questions: result.total_questions,
      funnel_style_notes: result.funnel_style_notes,
      format: null,
      ad_url: null,
      screenshot_url: null,
      ad_copy: null,
      cta: null,
    }),
  })

  if (!funnelRes.ok) {
    console.error(`❌ Failed to save funnel`)
    process.exit(1)
  }

  const funnel = await funnelRes.json()

  // Save slides
  for (let i = 0; i < result.slides.length; i++) {
    const slide = result.slides[i]
    await fetch(`${API_URL}/api/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        funnel_id: funnel.id,
        slide_order: i + 1,
        slide_type: slide.slide_type,
        question_text: slide.question_text,
        options: slide.options || [],
        screenshot_url: null,
        decoration_type: slide.decoration_type || "none",
        notes: slide.notes,
        style_notes: slide.style_notes,
      }),
    })
  }

  console.log(`\n🎉 Done! Funnel saved with ID: ${funnel.id}`)
  console.log(`👉 View at: ${API_URL}/funnel/${funnel.id}\n`)
}

main().catch((e) => {
  console.error("❌ Fatal error:", e.message)
  process.exit(1)
})
