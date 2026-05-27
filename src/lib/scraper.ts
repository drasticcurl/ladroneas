import puppeteer from "puppeteer"

export interface ScrapedSlide {
  base64: string
  text: string
  html: string
}

export async function scrapeQuizFunnel(url: string, maxSlides = 15): Promise<ScrapedSlide[]> {
  console.log("[scraper] 🚀 Abriendo Chrome...")
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 390, height: 844 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
  console.log("[scraper] ✅ Chrome abierto")

  const slides: ScrapedSlide[] = []

  try {
    const page = await browser.newPage()
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1")

    console.log("[scraper] 🌐 Navegando a: " + url)
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
    console.log("[scraper] ✅ Pagina cargada")
    await new Promise(r => setTimeout(r, 2000))

    let previousHtml = ""
    let stuckCount = 0

    for (let i = 0; i < maxSlides; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const currentHtml = await page.evaluate(() => document.body.innerHTML)

      if (currentHtml === previousHtml) {
        stuckCount++
        if (stuckCount >= 2) {
          console.log("[scraper] ⏹️  Sin cambios detectados. Terminando.")
          break
        }
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
        document.querySelectorAll("button, [role='button'], input, a, [data-option], [class*='option'], [class*='answer'], [class*='choice']").forEach(el => {
          const text = el.textContent?.trim() || ""
          if (text && text.length < 200) elements.push("<" + el.tagName.toLowerCase() + ">" + text + "</" + el.tagName.toLowerCase() + ">")
        })
        return elements.join("\n")
      })

      slides.push({ base64: screenshot as string, text: pageText, html: pageHtml })
      console.log("[scraper] 📸 Slide " + (i + 1) + " capturado (" + pageText.slice(0, 50).replace(/\n/g, " ") + "...)")

      const clicked = await tryClickNext(page)
      if (!clicked) {
        console.log("[scraper] ⏹️  No hay elementos clickeables. Terminando.")
        break
      }
      console.log("[scraper] 👆 Click realizado, esperando transicion...")
      await new Promise(r => setTimeout(r, 2000))
    }

    console.log("[scraper] ✅ Scraping terminado: " + slides.length + " slides")
    return slides
  } catch (error: any) {
    console.error("[scraper] ❌ Error durante scraping:", error.message)
    throw error
  } finally {
    await browser.close()
    console.log("[scraper] 🔒 Chrome cerrado")
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
