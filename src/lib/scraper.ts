import puppeteer, { Page } from "puppeteer"

export interface ScrapedSlide {
  base64: string
  text: string
  html: string
}

function timestamp(): string {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function log(emoji: string, msg: string) {
  console.log(`[${timestamp()}] [scraper] ${emoji} ${msg}`)
}

// Datos realistas para rellenar inputs según el contexto del quiz
const INPUT_PATTERNS: { pattern: RegExp; value: string | number }[] = [
  { pattern: /altur|height|cm|centimetr/i, value: 168 },
  { pattern: /peso|weight|kg|kilo/i, value: 72 },
  { pattern: /lbs|libras|pounds/i, value: 158 },
  { pattern: /edad|age|años|years/i, value: 32 },
  { pattern: /ft|feet|pie/i, value: 5 },
  { pattern: /inch|pulg/i, value: 6 },
  { pattern: /email|correo|mail/i, value: "maria.test@gmail.com" },
  { pattern: /nombre|name|first.?name/i, value: "Maria" },
  { pattern: /apellido|last.?name|surname/i, value: "Garcia" },
  { pattern: /tel[eé]fono|phone|cel/i, value: "+5491155551234" },
  { pattern: /meta|goal|objetivo/i, value: 60 },
  { pattern: /deseado|target|ideal/i, value: 60 },
]

async function detectAndFillInputs(page: Page): Promise<boolean> {
  const filled = await page.evaluate((patterns: { pattern: string; flags: string; value: string | number }[]) => {
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='submit']):not([type='button']), select, textarea"
    )
    if (inputs.length === 0) return { filled: false, details: [] }
    const details: string[] = []
    let didFill = false
    inputs.forEach(input => {
      const style = window.getComputedStyle(input)
      if (style.display === "none" || style.visibility === "hidden") return
      const rect = input.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const context = [
        input.getAttribute("placeholder") || "",
        input.getAttribute("name") || "",
        input.getAttribute("id") || "",
        input.getAttribute("aria-label") || "",
        input.getAttribute("type") || "",
      ].join(" ")
      const id = input.getAttribute("id")
      const label = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || "" : ""
      const parentText = input.parentElement?.textContent?.trim().slice(0, 100) || ""
      const fullContext = [context, label, parentText].join(" ")
      let value: string | number | null = null
      for (const p of patterns) {
        const regex = new RegExp(p.pattern, p.flags)
        if (regex.test(fullContext)) { value = p.value; break }
      }
      if (value === null) {
        const type = input.getAttribute("type") || "text"
        if (type === "number" || type === "tel") value = 30
        else if (type === "email") value = "maria.test@gmail.com"
        else value = "Maria"
      }
      if (input.tagName === "SELECT") {
        const select = input as HTMLSelectElement
        const options = Array.from(select.options)
        const validOption = options.find((o, i) => i > 0 && o.value && !o.disabled)
        if (validOption) {
          select.value = validOption.value
          select.dispatchEvent(new Event("change", { bubbles: true }))
          details.push(`select[${context.slice(0, 20)}]=${validOption.text}`)
          didFill = true
        }
      } else {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
        if (nativeInputValueSetter) { nativeInputValueSetter.call(input, String(value)) }
        else { (input as HTMLInputElement).value = String(value) }
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }))
        details.push(`input[${context.slice(0, 20)}]=${value}`)
        didFill = true
      }
    })
    return { filled: didFill, details }
  }, INPUT_PATTERNS.map(p => ({ pattern: p.pattern.source, flags: p.pattern.flags, value: p.value })))

  if (filled.filled) {
    log("✏️", `Inputs rellenados: ${(filled as any).details?.join(", ") || "ok"}`)
    await new Promise(r => setTimeout(r, 800))
    return true
  }
  return false
}

async function waitForContent(page: Page, timeoutMs = 8000): Promise<void> {
  const start = Date.now()
  let lastText = ""
  let stableCount = 0
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 500))
    const text = await page.evaluate(() => {
      const getText = (el: Element): string => {
        const tag = el.tagName
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "IFRAME") return ""
        if (el.children.length === 0) return el.textContent?.trim() || ""
        return Array.from(el.children).map(getText).filter(Boolean).join(" ")
      }
      return getText(document.body)
    })
    if (text.length > 20 && !text.includes("googletagmanager")) {
      if (text === lastText) { stableCount++; if (stableCount >= 2) return }
      else { stableCount = 0 }
      lastText = text
    }
  }
  log("⚠️", "Contenido no se estabilizó completamente, continuando...")
}

async function getVisibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const getText = (el: Element): string => {
      const tag = el.tagName
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "IFRAME" || tag === "SVG") return ""
      const style = window.getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return ""
      if (el.children.length === 0) return el.textContent?.trim() || ""
      return Array.from(el.children).map(getText).filter(Boolean).join("\n")
    }
    return getText(document.body)
  })
}

async function getInteractiveElements(page: Page): Promise<string> {
  return page.evaluate(() => {
    const elements: string[] = []
    document.querySelectorAll("button, [role='button'], input, a, [data-option], [class*='option'], [class*='answer'], [class*='choice']").forEach(el => {
      if (el.closest("noscript")) return
      const style = window.getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden") return
      const text = el.textContent?.trim() || ""
      if (text && text.length < 200 && !text.includes("googletagmanager")) {
        elements.push("<" + el.tagName.toLowerCase() + ">" + text + "</" + el.tagName.toLowerCase() + ">")
      }
    })
    return elements.join("\n")
  })
}

export async function scrapeQuizFunnel(url: string, maxSlides = 15): Promise<ScrapedSlide[]> {
  const startTime = Date.now()
  log("🚀", "Abriendo Chrome...")
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 390, height: 844 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
  log("✅", `Chrome abierto (${((Date.now() - startTime) / 1000).toFixed(1)}s)`)
  const slides: ScrapedSlide[] = []

  try {
    const page = await browser.newPage()
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1")
    log("🌐", "Navegando a: " + url)
    const navStart = Date.now()
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })
    log("✅", `Pagina cargada (${((Date.now() - navStart) / 1000).toFixed(1)}s)`)
    await waitForContent(page)

    let previousUrl = page.url()
    let previousText = ""
    let stuckCount = 0

    for (let i = 0; i < maxSlides; i++) {
      const slideStart = Date.now()
      const hasInputs = await detectAndFillInputs(page)
      if (hasInputs) log("📝", `   Slide tiene inputs, rellenados automáticamente`)

      const screenshot = await page.screenshot({ encoding: "base64", type: "png" })
      const pageText = await getVisibleText(page)
      const pageHtml = await getInteractiveElements(page)
      const currentUrl = page.url()

      if (pageText === previousText && currentUrl === previousUrl) {
        stuckCount++
        if (stuckCount >= 3) { log("⏹️", `Sin cambios (${stuckCount}x). Terminando.`); break }
        log("⚠️", `Pagina sin cambios (intento ${stuckCount}/3)...`)
      } else { stuckCount = 0 }
      previousText = pageText
      previousUrl = currentUrl

      slides.push({ base64: screenshot as string, text: pageText, html: pageHtml })
      const slideElapsed = ((Date.now() - slideStart) / 1000).toFixed(1)
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      const textPreview = pageText.slice(0, 60).replace(/\n/g, " ").trim()
      log("📸", `Slide ${i + 1}/${maxSlides} (${slideElapsed}s) [total: ${totalElapsed}s] [${currentUrl.split("/").slice(-2).join("/")}]`)
      log("📝", `   "${textPreview}..."`)
      log("🔘", `   Elementos interactivos: ${pageHtml.split("\n").filter(Boolean).length}`)

      const urlBefore = page.url()
      let clicked = false
      if (hasInputs) { clicked = await trySubmitForm(page); if (clicked) log("📨", `   Form enviado`) }
      if (!clicked) clicked = await tryClickNext(page)
      if (!clicked) { log("⏹️", "No hay elementos clickeables. Terminando."); break }
      log("👆", `Click realizado (${slides.length} slides hasta ahora)`)

      // Esperar a que el click haga efecto
      await new Promise(r => setTimeout(r, 1500))

      // Verificar si la página cambió - si no, es probablemente multi-select
      const textAfterClick = await getVisibleText(page)
      const urlAfterClick = page.url()
      if (textAfterClick === pageText && urlAfterClick === urlBefore) {
        log("🔍", `   Página sin cambiar post-click. Posible multi-select.`)

        // Seleccionar 1-2 opciones más (simular usuario eligiendo varias)
        const moreClicked = await tryClickMoreOptions(page, 2)
        if (moreClicked > 0) {
          log("✅", `   ${moreClicked} opciones extra seleccionadas (multi-select)`)
          await new Promise(r => setTimeout(r, 800))
        }

        // Buscar botón next/continue/submit para avanzar
        const nextClicked = await trySubmitForm(page)
        if (nextClicked) {
          log("📨", `   Botón next encontrado y clickeado`)
          await new Promise(r => setTimeout(r, 1500))
        } else {
          log("⚠️", `   No se encontró botón next después de seleccionar`)
        }
      }

      const urlAfter = page.url()
      if (urlAfter !== urlBefore) {
        log("🔀", `Nav: ${urlBefore.split("/").pop()} → ${urlAfter.split("/").pop()}`)
        try { await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {}) } catch {}
      }
      await waitForContent(page)
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    log("✅", `Scraping terminado: ${slides.length} slides en ${totalTime}s`)
    return slides
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    log("❌", `Error (${totalTime}s, ${slides.length} slides): ${error.message}`)
    if (slides.length > 0) { log("💡", `Retornando ${slides.length} slides parciales`); return slides }
    throw error
  } finally {
    await browser.close()
    log("🔒", "Chrome cerrado")
  }
}

async function trySubmitForm(page: Page): Promise<boolean> {
  // Textos que NO son botones de navegación (toggles de unidades, etc)
  const IGNORE_TEXTS = ["cm", "ft", "in", "ft/in", "kg", "lbs", "lb", "m", "mm", "st"]

  // First: buttons with explicit next/continue/submit text
  const textSelectors = ["button[type='submit']", "[class*='submit']", "[class*='next']", "[class*='continue']", "[class*='continuar']", "[class*='siguiente']"]
  for (const selector of textSelectors) {
    try {
      const elements = await page.$$(selector)
      for (const el of elements) {
        const isGood = await el.evaluate((node: any, ignoreTexts: string[]) => {
          const rect = node.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) return false
          const style = window.getComputedStyle(node)
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false
          const text = (node.textContent || "").trim().toLowerCase()
          if (text.includes("googletagmanager") || text.includes("gtag")) return false
          if (rect.top > window.innerHeight || rect.bottom < 0) return false
          // Ignorar toggles de unidades
          if (ignoreTexts.includes(text)) return false
          return text.includes("next") || text.includes("continu") || text.includes("siguien") || text.includes("submit") || text.includes("enviar") || text.includes("→") || text.includes("➡") || text.includes("adelante") || node.type === "submit"
        }, IGNORE_TEXTS)
        if (isGood) { const t = await el.evaluate((e: any) => e.textContent?.trim().slice(0, 40) || "?"); log("🎯", `   Submit: "${t}"`); await el.click(); return true }
      }
    } catch { continue }
  }

  // Second: any visible button that is NOT an option/answer and NOT a unit toggle
  try {
    const allButtons = await page.$$("button:not([disabled])")
    for (const btn of allButtons) {
      const isNavButton = await btn.evaluate((node: any, ignoreTexts: string[]) => {
        const rect = node.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return false
        const style = window.getComputedStyle(node)
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false
        if (rect.top > window.innerHeight || rect.bottom < 0) return false
        const text = (node.textContent || "").trim().toLowerCase()
        if (text.includes("googletagmanager") || text.includes("gtag")) return false
        // Skip unit toggles
        if (ignoreTexts.includes(text)) return false
        const cl = node.className || ""
        if (cl.includes("option") || cl.includes("answer") || cl.includes("choice")) return false
        // Must be a real nav element: arrow icon, or positioned at bottom
        const isArrow = text === "→" || text === "➡" || text === ">"
        const hasNavClass = cl.includes("nav") || cl.includes("forward") || cl.includes("arrow") || cl.includes("next")
        const isBottom = rect.top > window.innerHeight * 0.7
        return isArrow || hasNavClass || (isBottom && text.length > 3)
      }, IGNORE_TEXTS)
      if (isNavButton) {
        const t = await btn.evaluate((e: any) => e.textContent?.trim().slice(0, 40) || "(arrow/icon)")
        log("🎯", `   Nav button: "${t}"`)
        await btn.click()
        return true
      }
    }
  } catch {}

  return false
}

async function tryClickMoreOptions(page: Page, count: number): Promise<number> {
  const optionSelectors = [
    "[data-option]:not([class*='selected']):not([class*='active']):not([aria-selected='true'])",
    "[class*='option']:not([class*='selected']):not([class*='active']):not([class*='checked'])",
    "[class*='answer']:not([class*='selected']):not([class*='active'])",
    "[class*='choice']:not([class*='selected']):not([class*='active'])",
  ]

  let clicked = 0
  for (const selector of optionSelectors) {
    if (clicked >= count) break
    try {
      const elements = await page.$$(selector)
      for (const el of elements) {
        if (clicked >= count) break
        const isGood = await el.evaluate((node: any) => {
          const rect = node.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) return false
          const style = window.getComputedStyle(node)
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false
          const text = node.textContent || ""
          if (text.includes("googletagmanager")) return false
          if (rect.top > window.innerHeight || rect.bottom < 0) return false
          const cl = node.className || ""
          if (cl.includes("selected") || cl.includes("active") || cl.includes("checked")) return false
          if (node.getAttribute("aria-selected") === "true") return false
          return true
        })
        if (isGood) {
          const t = await el.evaluate((e: any) => e.textContent?.trim().slice(0, 30) || "?")
          await el.click()
          log("🎯", `   Multi-select: "${t}"`)
          clicked++
          await new Promise(r => setTimeout(r, 400))
        }
      }
    } catch { continue }
  }
  return clicked
}

async function tryClickNext(page: Page): Promise<boolean> {
  // Unit toggles that should NEVER be clicked as quiz options
  const IGNORE_TEXTS = ["cm", "ft", "in", "ft/in", "kg", "lbs", "lb", "m", "mm", "st"]

  const allSelectors = [
    "[data-option]", "[class*='option']:not([class*='selected'])", "[class*='answer']:not([class*='selected'])", "[class*='choice']:not([class*='selected'])",
    "[class*='quiz'] button", "[class*='question'] button", "button:not([type='submit']):not([disabled])",
    "[class*='next']", "[class*='continue']", "[class*='submit']", "button[type='submit']", "a[class*='option']", "a[class*='answer']",
  ]
  for (const selector of allSelectors) {
    try {
      const elements = await page.$$(selector)
      if (elements.length === 0) continue
      const visible = []
      for (const el of elements) {
        const isGood = await el.evaluate((node: any, ignoreTexts: string[]) => {
          const rect = node.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) return false
          const style = window.getComputedStyle(node)
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false
          const text = (node.textContent || "").trim()
          if (text.includes("googletagmanager") || text.includes("gtag")) return false
          if (rect.top > window.innerHeight || rect.bottom < 0) return false
          // Skip unit toggles
          if (ignoreTexts.includes(text.toLowerCase())) return false
          return true
        }, IGNORE_TEXTS)
        if (isGood) visible.push(el)
      }
      if (visible.length > 0) {
        const target = visible[Math.floor(Math.random() * Math.min(visible.length, 4))]
        const targetText = await target.evaluate((el: any) => el.textContent?.trim().slice(0, 40) || "?")
        log("🎯", `   Click: "${targetText}" (${selector}, ${visible.length} opts)`)
        await target.click()
        return true
      }
    } catch { continue }
  }
  return false
}
