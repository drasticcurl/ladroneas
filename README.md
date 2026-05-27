# Ladroneas - Quiz Funnel Extractor & Analyzer

Herramienta automatizada para **scrapear quiz funnels de competidores**, capturar screenshots de cada slide, y analizar con AI el copywriting, psicología y diseño visual.

## ¿Qué hace?

1. **Navega** un quiz funnel automáticamente con Puppeteer (Chrome headless mobile)
2. **Captura** screenshot de cada slide del quiz
3. **Rellena** inputs automáticamente (altura, peso, email, etc.)
4. **Analiza** con GPT-4.1-mini: copy, psicología, estilos, gatillos mentales
5. **Guarda** todo en Supabase (datos) + Cloudinary (screenshots)
6. **Muestra** el análisis en una UI con costo del request
7. **Exporta** el quiz completo como JSON (funnel + slides + URLs de imágenes) para pasarle a otra AI

---

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind + shadcn/ui
- **Scraping**: Puppeteer (Chrome headless, viewport mobile 390x844)
- **AI**: OpenAI GPT-4.1-mini (visión + texto)
- **DB**: Supabase (PostgreSQL)
- **Storage**: Cloudinary (screenshots PNG)
- **Deploy**: Vercel

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── extract/route.ts    ← API principal: scrapea + analiza
│   │   ├── funnels/route.ts    ← CRUD de funnels
│   │   └── slides/route.ts     ← CRUD de slides + upload a Cloudinary
│   ├── extract/page.tsx        ← UI del extractor (input URL + resultados)
│   ├── funnel/[id]/page.tsx    ← Vista de un funnel guardado
│   └── page.tsx                ← Home (lista de funnels)
├── components/                 ← UI components (shadcn)
├── lib/
│   ├── ai.ts                   ← Prompt + llamada a OpenAI
│   ├── scraper.ts              ← Puppeteer: navega el quiz, captura slides
│   ├── storage.ts              ← Upload de screenshots a Cloudinary
│   ├── supabase.ts             ← Cliente Supabase
│   └── types.ts                ← Tipos TypeScript (Funnel, FunnelSlide, etc)
└── scripts/
    └── extract.ts              ← Script CLI para correr local
```

---

## Setup

### 1. Clonar e instalar

```bash
git clone https://github.com/drasticcurl/ladroneas.git
cd ladroneas
npm install
```

### 2. Variables de entorno

Crear `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cloudinary (unsigned upload)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tu_upload_preset

# OpenAI
OPENAI_API_KEY=sk-...
```

### 3. Supabase DB

Crear tablas:

```sql
-- Funnels
create table extractor_123_funnels (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ad_url text,
  screenshot_url text,
  ad_copy text,
  cta text,
  landing_url text,
  format text,
  notes text,
  total_questions int default 0,
  funnel_style_notes text
);

-- Slides
create table extractor_123_slides (
  id uuid default gen_random_uuid() primary key,
  funnel_id uuid references extractor_123_funnels(id) on delete cascade,
  slide_order int,
  slide_type text default 'question',
  question_text text,
  options jsonb default '[]',
  screenshot_url text,
  decoration_type text default 'none',
  notes text,
  style_notes text
);
```

### 4. Cloudinary

- Crear un **upload preset** de tipo "Unsigned" en Settings → Upload
- Anotar el `cloud_name` y el nombre del preset

### 5. Correr

```bash
npm run dev
```

Ir a `http://localhost:3000/extract` y pegar una URL de quiz funnel.

---

## Flujo del extractor

```
[URL del quiz] → scrapeQuizFunnel()
                    ↓
        Puppeteer navega slide por slide:
        1. Detecta inputs → rellena (168cm, 72kg, 32 años, etc)
        2. Captura screenshot PNG (base64)
        3. Extrae texto visible + elementos interactivos
        4. Hace click en opción/continuar
        5. Espera transición / nueva página
        6. Repite hasta maxSlides o sin elementos
        7. En loading screens: espera 15s por redirect
        8. Último slide: fullPage screenshot + waitForImages
                    ↓
        analyzeWithGemini(screenshots[])
        → Envía todas las capturas a GPT-4.1-mini
        → Recibe análisis JSON estructurado
                    ↓
        Retorna al frontend:
        - slides[] con análisis por slide
        - funnel_style_notes (estilos globales)
        - ad_copy_insights (análisis de copy)
        - cost (tokens + USD)
```

---

## Scraper: cómo navega el quiz

### Click logic (en orden de prioridad)

1. Si hay **inputs** (text/number) → `detectAndFillInputs()` → `trySubmitForm()` busca "Continuar"
2. Si no → `tryClickNext()` busca opciones de quiz (`[data-option]`, `[class*='option']`, buttons)
3. Post-click verifica si cambió la página. Si no cambió:
   - Asume **multi-select**: clickea 1-2 opciones más
   - Busca botón "Next/Continuar/Siguiente"

### Qué ignora (IGNORE_TEXTS)

El scraper NO clickea: `cm`, `ft`, `in`, `ft/in`, `kg`, `lbs`, `lb`, `m`, `mm`, `st`  
(Son toggles de unidades, no opciones de quiz)

### Auto-fill de inputs

| Contexto detectado | Valor que pone |
|---|---|
| altura/height/cm | 168 |
| peso/weight/kg | 72 |
| edad/age/años | 32 |
| email | maria.test@gmail.com |
| nombre | Maria |
| target/ideal/objetivo | 60 |

### Loading screens

Si no hay elementos clickeables, espera hasta 15s polling cada 3s. Si detecta contenido nuevo → `waitForImages()` → fullPage screenshot.

### waitForImages()

Antes del screenshot final:
1. Espera que todas las `<img>` carguen (5s timeout c/u)
2. Espera que `document.getAnimations()` esté vacío
3. +2s buffer extra para fonts y lazy loads

---

## AI: prompt y análisis

### Para slides tipo "question"

Analiza por cada slide:
- Gatillo mental principal (escasez, autoridad, prueba social, etc)
- Técnica de persuasión (micro-compromiso, foot-in-the-door, etc)
- Emoción target (esperanza, frustración, validación, etc)
- Sesgo cognitivo explotado
- Por qué está en esa posición del funnel
- Nivel de compromiso (bajo/medio/alto)

### Para slides tipo "result" u "offer" (página final)

Desglose SECCIÓN POR SECCIÓN de arriba a abajo:
- **HEADLINE**: personalización, emoción
- **RESULTADO PERSONALIZADO**: datos del quiz, formato
- **PRUEBA SOCIAL**: testimonios, reviews, ratings
- **GRÁFICO/PROYECCIÓN**: charts, timelines
- **OFERTA/PRICING**: anclaje, trial, precio/día
- **URGENCIA/ESCASEZ**: countdown, límites
- **GARANTÍA**: money-back, condiciones
- **BENEFICIOS**: qué incluye el plan
- **CTA BOTÓN**: texto exacto, color
- **OBJECIONES**: FAQ, "sin compromiso"
- **CREDIBILIDAD**: logos pago seguro, SSL
- **BONUS/UPSELL**: extras

### Análisis global (ad_copy_insights)

- Estructura narrativa del funnel
- Tone of voice
- Power words
- Escalera de compromiso slide a slide
- Técnica de pricing
- Target audience

### Cost tracking

Cada request muestra:
- Tokens input/output (reales de la API)
- Costo en USD (pricing gpt-4.1-mini: $0.40/1M in, $1.60/1M out)
- Velocidad (tokens/s)
- Tiempo total

---

## UI

### Extract page (`/extract`)

- Input de URL + selector de maxSlides (5-60, default 30) + **delay por slide** (1-30s, default 3s)
- El delay controla cuánto esperar para imágenes/animaciones por slide (antes era 10s fijo, una banda)
- Muestra progreso mientras scrapea
- Resultados: card con costo + textareas editables de estilos/copy
- Lista de slides con screenshot + análisis
- Botón "Guardar como Funnel" → sube screenshots a Cloudinary + guarda en DB

### Funnel view (`/funnel/[id]`)

- Vista del funnel guardado con todos sus slides
- Screenshots desde Cloudinary URLs
- **Botón "Exportar JSON"** — descarga un `.json` con toda la data del funnel + slides + URLs de imágenes, listo para pasarle a una AI para análisis

---

## Storage (Cloudinary)

Screenshots se guardan en: `funnels/{funnelId}/slide_01.png`, `slide_02.png`, etc.

- Upload: unsigned preset (FormData con data URI base64)
- URLs públicas guardadas en `screenshot_url` de cada slide
- Accesibles para exportador futuro

---

## Scripts

### CLI local

```bash
npx tsx scripts/extract.ts "https://quiz-url.com"
npx tsx scripts/extract.ts --from-cache ".cache/dir"  # reusar capturas
```

El script local guarda capturas en `.cache/` para no perder progreso si falla la AI.

---

## Env vars resumen

| Variable | Dónde se usa | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | supabase.ts | DB connection |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase.ts | DB admin access |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | storage.ts | Upload screenshots |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | storage.ts | Unsigned upload preset |
| `OPENAI_API_KEY` | ai.ts | GPT-4.1-mini API |

---

## PRs históricos (contexto)

| PR | Qué resolvió |
|---|---|
| #9 | Caching, retries, mejor logging |
| #11 | Cost tracking, input auto-fill, GTM fix, estilos detallados |
| #12 | Multi-select quiz slides |
| #14 | No clickear unit toggles (cm/kg) en trySubmitForm |
| #16 | No clickear unit toggles en tryClickNext |
| #17 | trySubmitForm encuentra "Continuar" sin clase CSS específica |
| #18 | Verbose element logging por slide |
| #19 | maxSlides configurable, fullPage last screenshot, prompt copy mejorado |
| #20 | Esperar loading screens (15s) antes de terminar |
| #21 | waitForImages() antes de screenshot final |
| #22 | Prompt detallado sección por sección para páginas de pago |
| #24 | Guardar screenshots en Cloudinary |
| #25 | Fix: Cloudinary upload usa FormData en vez de JSON |
| #27 | Botón "Exportar JSON" en detalle de funnel |
| #28 | Delay configurable por slide (default 3s en vez de 10s) |

---

## Reglas del repo

- **Cada cambio = branch nuevo + PR nuevo**. Nunca reusar branches de PRs mergeados.
- Siempre pull main antes de crear branch.
- Verificar que no haya conflictos antes de pushear.
