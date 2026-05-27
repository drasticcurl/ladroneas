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

async function logAllElements(page: Page, slideNum: number): Promise<void> {
  const elements = await page.evaluate(() => {
    const results: { type: string; tag: string; text: string; classes: string; id: string; name: string; inputType: string; disabled: boolean; visible: boolean; pos: string }[] = []

    // Buttons
    document.querySelectorAll("button, [role='button'], [type='submit']").forEach(el => {
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
      const text = (el.textContent || "").trim().slice(0, 50)
      if (!text || text.includes("googletagmanager")) return
      results.push({
        type: "BTN",
        tag: el.tagName.toLowerCase(),
        text,
        classes: (el.className || "").toString().slice(0, 40),
        id: el.id || "",
        name: el.getAttribute("name") || "",
        inputType: el.getAttribute("type") || "",
        disabled: (el as any).disabled || false,
        visible,
        pos: `${Math.round(rect.top)}y`,
      })
    })

    // Inputs
    document.querySelectorAll("input, select, textarea").forEach(el => {
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
      const inp = el as HTMLInputElement
      if (inp.type === "hidden") return
      results.push({
        type: "INPUT",
        tag: el.tagName.toLowerCase(),
        text: inp.value || inp.placeholder || "",
        classes: (el.className || "").toString().slice(0, 40),
        id: el.id || "",
        name: el.getAttribute("name") || "",
        inputType: inp.type || "",
        disabled: inp.disabled || false,
        visible,
        pos: `${Math.round(rect.top)}y`,
      })
    })

    // Options/answers (divs/spans that look like clickable options)
    document.querySelectorAll("[data-option], [class*='option'], [class*='answer'], [class*='choice']").forEach(el => {
      if (el.tagName === "BUTTON" || el.tagName === "INPUT") return // already captured
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
      const text = (el.textContent || "").trim().slice(0, 50)
      if (!text || text.includes("googletagmanager")) return
      results.push({
        type: "OPT",
        tag: el.tagName.toLowerCase(),
        text,
        classes: (el.className || "").toString().slice(0, 40),
        id: el.id || "",
        name: "",
        inputType: "",
        disabled: false,
        visible,
        pos: `${Math.round(rect.top)}y`,
      })
    })

    return results
  })

  if (elements.length === 0) {
    log("🔎", `   [Slide ${slideNum}] No se encontraron elementos interactivos`)
    return
  }

  log("🔎", `   [Slide ${slideNum}] ${elements.length} elementos detectados:`)
  for (const el of elements) {
    const vis = el.visible ? "✓" : "✗"
    const dis = el.disabled ? " [DISABLED]" : ""
    const cls = el.classes ? ` class="${el.classes}"` : ""
    const id = el.id ? ` id="${el.id}"` : ""
    const name = el.name ? ` name="${el.name}"` : ""
    const iType = el.inputType ? ` type="${el.inputType}"` : ""
    log("🔎", `     ${vis} ${el.type} <${el.tag}${iType}${id}${name}${cls}> "${el.text}" [${el.pos}]${dis}`)
  }
}

export async function scrapeQuizFunnel(url: string, maxSlides = 30): Promise<ScrapedSlide[]> {
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

      // En el último slide, tomar screenshot de página completa (suele ser página de pago/resultado)
      const isLastSlide = i === maxSlides - 1
      const screenshot = await page.screenshot({ encoding: "base64", type: "png", fullPage: isLastSlide })
      if (isLastSlide) log("📐", `   Último slide: screenshot de página COMPLETA`)
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

      // Log detallado de TODOS los elementos del slide para debugging
      await logAllElements(page, i + 1)

      const urlBefore = page.url()
      let clicked = false
      if (hasInputs) { clicked = await trySubmitForm(page); if (clicked) log("📨", `   Form enviado`) }
      if (!clicked) clicked = await tryClickNext(page)
      if (!clicked) {
        // No hay elementos clickeables - podría ser una pantalla de loading/animación
        // Esperar hasta 15s por si redirige o muestra nuevo contenido después
        log("⏳", "No hay elementos clickeables. Esperando por posible loading/redirect...")
        let foundNewContent = false
        for (let wait = 0; wait < 5; wait++) {
          await new Promise(r => setTimeout(r, 3000))
          const newText = await getVisibleText(page)
          const newUrl = page.url()
          if (newText !== pageText || newUrl !== currentUrl) {
            log("✅", `   Contenido nuevo detectado después de ${(wait + 1) * 3}s de espera`)
            foundNewContent = true
            // Tomar screenshot de página completa (probablemente es resultado/pago)
            const finalScreenshot = await page.screenshot({ encoding: "base64", type: "png", fullPage: true })
            const finalText = await getVisibleText(page)
            const finalHtml = await getInteractiveElements(page)
            slides.push({ base64: finalScreenshot as string, text: finalText, html: finalHtml })
            log("📸", `   Screenshot final (fullPage) capturado: "${finalText.slice(0, 60).replace(/\n/g, " ")}..."`)
            break
          }
        }
        if (!foundNewContent) {
          log("⏹️", "Sin contenido nuevo después de 15s. Terminando.")
        }
        break
      }
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

  // Search ALL buttons (not just ones with specific classes) for nav-like text
  // This catches "Continuar" buttons that don't have class="continue" or class="next"
  const selectors = [
    "button[type='submit']",
    "[class*='submit']", "[class*='next']", "[class*='continue']", "[class*='continuar']", "[class*='siguiente']",
    "button:not([disabled])",  // catch-all: any enabled button, filtered by text below
  ]
  for (const selector of selectors) {
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
          // Must contain navigation-like text
          return text.includes("next") || text.includes("continu") || text.includes("siguien") || text.includes("submit") || text.includes("enviar") || text.includes("→") || text.includes("➡") || text.includes("adelante") || node.type === "submit"
        }, IGNORE_TEXTS)
        if (isGood) { const t = await el.evaluate((e: any) => e.textContent?.trim().slice(0, 40) || "?"); log("🎯", `   Submit: "${t}"`); await el.click(); return true }
      }
    } catch { continue }
  }

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
