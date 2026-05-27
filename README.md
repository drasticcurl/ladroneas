# Ladroneas - Quiz Funnel Extractor & Analyzer

Herramienta para extraer, analizar y documentar quiz funnels de competidores usando scraping + AI.

## Features

- **Extractor automático** — Pega una URL de un quiz funnel y el sistema lo navega automáticamente (Puppeteer), captura screenshots de cada slide y los analiza con AI (OpenAI).
- **Delay configurable por slide** — Podés elegir cuántos segundos esperar por slide (default: 3s). Si el quiz tiene muchas animaciones/imágenes podés subirlo.
- **Análisis con AI** — Detecta tipo de slide (pregunta, intro, resultado, oferta), opciones, emojis, estilo visual, copy y psicología.
- **Editor de slides** — Editá las preguntas, opciones y notas de cada slide manualmente.
- **Exportar JSON** — Desde el detalle de un funnel, exportá todo (funnel + slides + URLs de imágenes) como JSON para pasárselo a una AI para análisis.
- **Almacenamiento** — Supabase para datos + Cloudinary para screenshots.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Puppeteer (scraping), OpenAI API (análisis)
- **DB**: Supabase (PostgreSQL)
- **Storage**: Cloudinary (screenshots)

## Setup

1. Clonar el repo
2. `npm install`
3. Copiar `.env.local.example` a `.env.local` y completar las variables:
   - `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
4. `npm run dev`

## Uso

### Extractor Web (`/extract`)

1. Pegar URL del quiz funnel
2. Configurar:
   - **Max slides** (default: 30) — máximo de slides a extraer
   - **Delay por slide** (default: 3s) — tiempo de espera para imágenes/animaciones por slide
3. Click "Extraer" — el sistema navega el quiz, captura screenshots y analiza con AI
4. Revisar/editar los resultados y guardar como funnel

### Extractor CLI (`scripts/extract.ts`)

```bash
npx tsx scripts/extract.ts <URL> [maxSlides]
```

Captura screenshots localmente y los envía al API para análisis.

### Exportar Funnel

Desde la página de detalle de un funnel (`/funnel/[id]`), click en **"Exportar JSON"** para descargar todo el quiz en formato JSON (incluye URLs de imágenes).

## Estructura

```
src/
├── app/
│   ├── api/
│   │   ├── extract/     — API de extracción (scraping + AI)
│   │   ├── funnels/     — CRUD de funnels
│   │   └── slides/      — CRUD de slides
│   ├── extract/         — UI del extractor
│   └── funnel/[id]/     — Detalle y editor de funnel
├── components/          — Componentes React (slide editor, preview, etc)
└── lib/
    ├── ai.ts            — Integración con OpenAI
    ├── scraper.ts       — Puppeteer scraper del quiz
    ├── storage.ts       — Upload a Cloudinary
    ├── supabase.ts      — Cliente Supabase
    └── types.ts         — TypeScript types
```

## Deploy

Deploy en Vercel. Asegurate de:
- Agregar todas las env vars
- El plan debe soportar funciones serverless con timeout extendido (el scraping puede tardar 1-3 min)
