import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"

export interface ScrapedSlide {
  base64: string
  text: string
  html: string
}

export async function scrapeQuizFunnel(url: string, maxSlides = 15): Promise<ScrapedSlide[]> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 390, height: 844 },
    executablePath: await chromium.executablePath(),
    headless: true,
  })

  const slides: ScrapedSlide[] = []

  try {
    const page = await browser.newPage()
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1")
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000))

    let previousHtml = ""
    let stuckCount = 0

    for (let i = 0; i < maxSlides; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const currentHtml = await page.evaluate(() => document.body.innerHTML)

      if (currentHtml === previousHtml) {
        stuckCount++
        if (stuckCount >= 2) break
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

      const clicked = await tryClickNext(page)
      if (!clicked) break
      await new Promise(r => setTimeout(r, 2000))
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
