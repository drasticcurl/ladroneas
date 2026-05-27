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
const FAKE_DATA: Record<string, string | number> = {
  // Números
  age: 32,
  edad: 32,
  peso: 72,
  weight: 72,
  altura: 168,
  height: 168,
  cm: 168,
  kg: 72,
  lbs: 158,
  ft: 5,
  in: 6,
  // Texto
  name: "Maria",
  nombre: "Maria",
  email: "maria.test@gmail.com",
  phone: "+5491155551234",
  telefono: "+5491155551234",
}

// Patrones para detectar qué tipo de dato pide un input
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
      // Skip si ya tiene valor o no es visible
      const style = window.getComputedStyle(input)
      if (style.display === "none" || style.visibility === "hidden") return
      const rect = input.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      // Juntar contexto del input: placeholder, label, name, id, texto cercano
      const context = [
        input.getAttribute("placeholder") || "",
        input.getAttribute("name") || "",
        input.getAttribute("id") || "",
        input.getAttribute("aria-label") || "",
        input.getAttribute("type") || "",
      ].join(" ")

      // Buscar label asociado
      const id = input.getAttribute("id")
      const label = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || "" : ""
      
      // También buscar texto del parent/sibling
      const parentText = input.parentElement?.textContent?.trim().slice(0, 100) || ""
      const fullContext = [context, label, parentText].join(" ")

      // Intentar matchear con los patrones
      let value: string | number | null = null
      for (const p of patterns) {
        const regex = new RegExp(p.pattern, p.flags)
        if (regex.test(fullContext)) {
          value = p.value
          break
        }
      }

      // Si no matcheó ningún patrón, usar defaults según tipo
      if (value === null) {
        const type = input.getAttribute("type") || "text"
        if (type === "number" || type === "tel") value = 30
        else if (type === "email") value = "maria.test@gmail.com"
        else value = "Maria"
      }

      // Rellenar el input
      if (input.tagName === "SELECT") {
        const select = input as HTMLSelectElement
        // Seleccionar la primera opción que no sea placeholder
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
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(input, String(value))
        } else {
          (input as HTMLInputElement).value = String(value)
        }
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
        // También dispatch keyup por si usa ese event
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }))
        details.push(`input[${context.slice(0, 20)}]=${value}`)
        didFill = true
      }
    })

    return { filled: didFill, details }
  }, INPUT_PATTERNS.map(p => ({ pattern: p.pattern.source, flags: p.pattern.flags, value: p.value })))

  if (filled.filled) {
    log("✏️", `Inputs rellenados: ${(filled as any).details?.join(", ") || "ok"}`)
    // Esperar un poco para que el UI reaccione
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
      if (text === lastText) {
        stableCount++
        if (stableCount >= 2) return
      } else {
        stableCount = 0
      }
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
    document.querySelectorAll(
      "button, [role='button'], input, a, [data-option], [class*='option'], [class*='answer'], [class*='choice']"
    ).forEach(el => {
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

      // Detectar y rellenar inputs ANTES de capturar screenshot
      const hasInputs = await detectAndFillInputs(page)
      if (hasInputs) {
        log("📝", `   Slide tiene inputs de texto/número, rellenados automáticamente`)
      }

      const screenshot = await page.screenshot({ encoding: "base64", type: "png" })
      const pageText = await getVisibleText(page)
      const pageHtml = await getInteractiveElements(page)
      const currentUrl = page.url()

      // Detectar stuck
      if (pageText === previousText && currentUrl === previousUrl) {
        stuckCount++
        if (stuckCount >= 3) {
          log("⏹️", `Sin cambios detectados (${stuckCount} veces seguidas). Terminando.`)
          break
        }
        log("⚠️", `Pagina sin cambios (intento ${stuckCount}/3)...`)
      } else {
        stuckCount = 0
      }
      previousText = pageText
      previousUrl = currentUrl

      slides.push({ base64: screenshot as string, text: pageText, html: pageHtml })
      const slideElapsed = ((Date.now() - slideStart) / 1000).toFixed(1)
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      const textPreview = pageText.slice(0, 60).replace(/\n/g, " ").trim()
      log("📸", `Slide ${i + 1}/${maxSlides} capturado (${slideElapsed}s) [total: ${totalElapsed}s] [${currentUrl.split("/").slice(-2).join("/")}]`)
      log("📝", `   Texto: "${textPreview}..."`)
      log("🔘", `   Elementos interactivos: ${pageHtml.split("\n").filter(Boolean).length}`)

      // Intentar avanzar: primero submit si hay inputs, sino click normal
      const urlBefore = page.url()
      let clicked = false

      if (hasInputs) {
        // Si hay inputs, buscar botón de submit/next/continue
        clicked = await trySubmitForm(page)
        if (clicked) {
          log("📨", `   Formulario enviado`)
        }
      }

      if (!clicked) {
        clicked = await tryClickNext(page)
      }

      if (!clicked) {
        log("⏹️", "No hay elementos clickeables. Terminando.")
        break
      }
      log("👆", `Click realizado, esperando transicion... (${slides.length} slides hasta ahora)`)

      // Esperar transición
      const urlAfter = page.url()
      if (urlAfter !== urlBefore) {
        log("🔀", `Navegacion detectada: ${urlBefore.split("/").pop()} → ${urlAfter.split("/").pop()}`)
        try {
          await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {})
        } catch {}
      }

      await waitForContent(page)
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    log("✅", `Scraping terminado: ${slides.length} slides en ${totalTime}s`)
    return slides
  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    log("❌", `Error durante scraping (${totalTime}s, ${slides.length} slides capturados): ${error.message}`)
    if (slides.length > 0) {
      log("💡", `Se capturaron ${slides.length} slides antes del error, retornando parcial`)
      return slides
    }
    throw error
  } finally {
    await browser.close()
    log("🔒", "Chrome cerrado")
  }
}

async function trySubmitForm(page: Page): Promise<boolean> {
  const submitSelectors = [
    "button[type='submit']",
    "[class*='submit']",
    "[class*='next']",
    "[class*='continue']",
    "[class*='continuar']",
    "[class*='siguiente']",
    "button:not([disabled])",
  ]

  for (const selector of submitSelectors) {
    try {
      const elements = await page.$$(selector)
      for (const el of elements) {
        const isGood = await el.evaluate((node: any) => {
          const rect = node.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) return false
          const style = window.getComputedStyle(node)
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false
          const text = (node.textContent || "").toLowerCase()
          if (text.includes("googletagmanager") || text.includes("gtag")) return false
          if (rect.top > window.innerHeight || rect.bottom < 0) return false
          // Preferir botones que parecen "next/continue/submit"
          const isSubmitLike = text.includes("next") || text.includes("continu") || text.includes("siguien") ||
            text.includes("submit") || text.includes("enviar") || text.includes("→") || text.includes("➡")
          return isSubmitLike || node.type === "submit"
        })
        if (isGood) {
          const targetText = await el.evaluate((el: any) => el.textContent?.trim().slice(0, 40) || "?")
          log("🎯", `   Submit: "${targetText}" (${selector})`)
          await el.click()
          return true
        }
      }
    } catch { continue }
  }
  return false
}

async function tryClickNext(page: Page): Promise<boolean> {
  const quizSelectors = [
    "[data-option]",
    "[class*='option']:not([class*='selected'])",
    "[class*='answer']:not([class*='selected'])",
    "[class*='choice']:not([class*='selected'])",
  ]

  const buttonSelectors = [
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

  const allSelectors = [...quizSelectors, ...buttonSelectors]

  for (const selector of allSelectors) {
    try {
      const elements = await page.$$(selector)
      if (elements.length > 0) {
        const visible = []
        for (const el of elements) {
          const isGood = await el.evaluate((node: any) => {
            const rect = node.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) return false
            const style = window.getComputedStyle(node)
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false
            const text = node.textContent || ""
            if (text.includes("googletagmanager") || text.includes("gtag")) return false
            if (rect.top > window.innerHeight || rect.bottom < 0) return false
            return true
          })
          if (isGood) visible.push(el)
        }

        if (visible.length > 0) {
          const target = visible[Math.floor(Math.random() * Math.min(visible.length, 4))]
          const targetText = await target.evaluate((el: any) => el.textContent?.trim().slice(0, 40) || "?")
          log("🎯", `   Clickeando: "${targetText}" (selector: ${selector}, ${visible.length} opciones)`)
          await target.click()
          return true
        }
      }
    } catch { continue }
  }
  return false
}
