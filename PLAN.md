# Ad Spy - Quiz Funnel Analyzer

## Objetivo

App para registrar, analizar y documentar anuncios de quiz funnels (low ticket) encontrados en Meta Ad Library, enfocado en el mercado argentino. Permite mapear cada funnel paso a paso (slide por slide) con detalle visual y escrito, para extraer insights y mejorar tu propio funnel.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Base de datos | Supabase (PostgreSQL) |
| Imágenes | Cloudinary (upload via API) |
| AI (Fase 2) | Google Gemini API |
| Scraping (Fase 2) | Playwright |
| Deploy | Vercel |
| Auth | No (uso personal) |

---

## Estructura de Base de Datos

### Tabla: `extractor_123`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid (PK) | ID único |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Última modificación |
| ad_url | text | URL del anuncio en Ad Library |
| screenshot_url | text | Screenshot del anuncio (Cloudinary) |
| ad_copy | text | Texto/copy del anuncio |
| cta | text | Call to action del anuncio |
| landing_url | text | URL del quiz funnel / landing |
| format | text | Formato: 'video' / 'imagen' / 'carrusel' |
| notes | text | Notas personales / observaciones |
| total_questions | integer | Cantidad total de preguntas del funnel |
| funnel_style_notes | text | Descripción general de estilos del funnel (colores, tipografía, vibe general) |

### Tabla: `extractor_123_slides`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid (PK) | ID único |
| funnel_id | uuid (FK → extractor_123.id) | Referencia al funnel |
| slide_order | integer | Orden del slide (1, 2, 3...) |
| slide_type | text | Tipo: 'question' / 'intro' / 'result' / 'offer' / 'other' |
| question_text | text | Texto de la pregunta o título del slide |
| options | jsonb | Array de opciones de respuesta (texto + metadata) |
| screenshot_url | text | Screenshot del slide (Cloudinary) |
| decoration_type | text | 'emojis' / 'images' / 'none' — qué usan en las respuestas |
| notes | text | Notas sobre este slide específico |
| style_notes | text | Notas sobre diseño/estilo visual de este slide |

#### Estructura del campo `options` (JSONB):

```json
[
  {
    "text": "Texto de la opción",
    "emoji": "🏠",
    "image_url": "https://...",
    "notes": "Observación sobre esta opción"
  }
]
```

---

## Features de la App

### Dashboard / Home
- Lista de todos los funnels guardados
- Vista de cards con screenshot, copy truncado, y cantidad de slides
- Búsqueda por texto (en copy, notas, etc.)
- Ordenar por fecha de creación

### Crear / Editar Funnel
- Formulario con todos los campos del anuncio
- Upload de screenshot del anuncio a Cloudinary
- Editor de slides del funnel (agregar, reordenar, eliminar)
- Preview visual del funnel completo

### Detalle de Funnel
- Vista completa del anuncio (copy, screenshot, CTA, etc.)
- Sección de "Estilo General" del funnel
- Timeline/stepper visual de todos los slides
- Cada slide muestra: pregunta, opciones, decoración, screenshot, notas

### Editor de Slides
- Formulario por slide con:
  - Tipo de slide (question, intro, result, offer, other)
  - Texto de la pregunta
  - Opciones de respuesta (agregar/eliminar dinámicamente)
  - Switch de decoración: emojis / imágenes / nada
  - Upload de screenshot del slide
  - Notas y notas de estilo
- Drag & drop para reordenar slides
- Botón de duplicar slide (útil cuando son similares)

---

## Fases de Implementación

### Fase 1: App Base (CRUD + UI)

#### 1.1 — Setup del proyecto
- [ ] Inicializar Next.js 14 con App Router
- [ ] Instalar y configurar Tailwind CSS + shadcn/ui
- [ ] Configurar Supabase client (env vars)
- [ ] Configurar Cloudinary (env vars)
- [ ] Crear estructura de carpetas

#### Estructura de carpetas:
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Dashboard
│   ├── funnel/
│   │   ├── new/page.tsx           # Crear funnel
│   │   └── [id]/
│   │       ├── page.tsx           # Detalle funnel
│   │       └── edit/page.tsx      # Editar funnel
│   └── api/
│       ├── funnels/route.ts       # CRUD funnels
│       ├── slides/route.ts        # CRUD slides
│       └── upload/route.ts        # Upload a Cloudinary
├── components/
│   ├── ui/                        # shadcn components
│   ├── funnel-card.tsx
│   ├── funnel-form.tsx
│   ├── slide-editor.tsx
│   ├── slide-list.tsx
│   ├── slide-preview.tsx
│   ├── image-upload.tsx
│   └── options-editor.tsx
├── lib/
│   ├── supabase.ts
│   ├── cloudinary.ts
│   └── types.ts
└── styles/
    └── globals.css
```

#### 1.2 — Base de datos
- [ ] Crear tabla `extractor_123` en Supabase
- [ ] Crear tabla `extractor_123_slides` en Supabase
- [ ] Configurar RLS desactivado (uso personal)

#### 1.3 — API Routes
- [ ] GET/POST /api/funnels — listar y crear funnels
- [ ] GET/PUT/DELETE /api/funnels/[id] — detalle, editar, borrar
- [ ] GET/POST /api/slides — listar slides de un funnel, crear slide
- [ ] PUT/DELETE /api/slides/[id] — editar, borrar slide
- [ ] PUT /api/slides/reorder — reordenar slides
- [ ] POST /api/upload — subir imagen a Cloudinary

#### 1.4 — UI: Dashboard
- [ ] Grid de funnel cards
- [ ] Barra de búsqueda
- [ ] Botón "Nuevo Funnel"
- [ ] Estado vacío (cuando no hay funnels)

#### 1.5 — UI: Formulario de Funnel
- [ ] Campos del anuncio (URL, copy, CTA, formato, etc.)
- [ ] Upload de screenshot con preview
- [ ] Textarea para notas generales
- [ ] Campo de estilo general del funnel
- [ ] Botón guardar

#### 1.6 — UI: Editor de Slides
- [ ] Lista de slides con drag & drop
- [ ] Formulario de cada slide (tipo, pregunta, opciones)
- [ ] Switch de decoración (emojis/imágenes/nada)
- [ ] Editor de opciones dinámico (agregar/eliminar respuestas)
- [ ] Upload de screenshot por slide
- [ ] Duplicar slide
- [ ] Eliminar slide con confirmación

#### 1.7 — UI: Vista de Detalle
- [ ] Header con info del anuncio
- [ ] Screenshot del anuncio
- [ ] Sección de estilo general
- [ ] Timeline/stepper de slides
- [ ] Cada slide expandible con toda su info

---

### Fase 2: Extractor Automático con AI

#### 2.1 — Scraper de Quiz Funnels
- [ ] Endpoint API que recibe una URL de quiz funnel
- [ ] Playwright navega el quiz automáticamente
- [ ] Captura screenshot de cada slide
- [ ] Extrae texto, opciones, y estructura del DOM
- [ ] Maneja diferentes frameworks de quiz (Typeform, Bucket.io, custom, etc.)

#### 2.2 — Análisis con Gemini
- [ ] Enviar screenshots + texto extraído a Gemini
- [ ] Prompt engineered para extraer:
  - Tipo de cada slide
  - Preguntas y opciones
  - Estilo de decoración (emojis/imágenes/nada)
  - Observaciones sobre diseño y copywriting
  - Estilo general del funnel
- [ ] Gemini devuelve JSON estructurado

#### 2.3 — Flujo completo de extracción
- [ ] UI: Input de URL + botón "Extraer Funnel"
- [ ] Loading state con progreso (scrapeando... analizando... guardando...)
- [ ] Preview del resultado antes de guardar
- [ ] Permite editar/corregir lo que Gemini extrajo
- [ ] Guardar como funnel nuevo

#### 2.4 — Consideraciones del scraper
- Algunos quizzes requieren responder para avanzar → el scraper clickea opciones random
- Rate limiting: no bombardear los sitios
- Timeout configurable por si el quiz es muy largo
- Fallback: si el scraper falla, permite cargar manual con los screenshots que sí pudo sacar

---

### Fase 3 (Opcional/Futura): Mejoras

- [ ] Exportar funnel como PDF/imagen para compartir
- [ ] Comparador side-by-side de dos funnels
- [ ] Tags o labels para agrupar (ej: "por nicho", "los mejores", etc.)
- [ ] Métricas estimadas (días activo el anuncio basado en Ad Library)
- [ ] Templates: crear tu propio funnel basado en los que analizaste

---

## Variables de Entorno Necesarias

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# Gemini (Fase 2)
GEMINI_API_KEY=tu_api_key
```

---

## SQL para crear las tablas

```sql
-- Tabla principal de funnels
CREATE TABLE extractor_123 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ad_url TEXT,
  screenshot_url TEXT,
  ad_copy TEXT,
  cta TEXT,
  landing_url TEXT,
  format TEXT CHECK (format IN ('video', 'imagen', 'carrusel')),
  notes TEXT,
  total_questions INTEGER DEFAULT 0,
  funnel_style_notes TEXT
);

-- Tabla de slides
CREATE TABLE extractor_123_slides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID REFERENCES extractor_123(id) ON DELETE CASCADE,
  slide_order INTEGER NOT NULL,
  slide_type TEXT CHECK (slide_type IN ('question', 'intro', 'result', 'offer', 'other')),
  question_text TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  screenshot_url TEXT,
  decoration_type TEXT CHECK (decoration_type IN ('emojis', 'images', 'none')) DEFAULT 'none',
  notes TEXT,
  style_notes TEXT
);

-- Índice para ordenar slides rápido
CREATE INDEX idx_extractor_123_slides_order ON extractor_123_slides(funnel_id, slide_order);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER extractor_123_updated_at
  BEFORE UPDATE ON extractor_123
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

## Notas de Diseño (UI)

- **Dark mode** por defecto
- **Minimalista** — sin ruido visual, foco en el contenido
- Tipografía legible (Inter o similar)
- Cards con bordes sutiles y hover states
- Formularios limpios con buena separación
- Timeline de slides visual e intuitiva
- Responsive pero priorizando desktop (es una herramienta de trabajo)

---

## Próximos Pasos

1. ✅ Revisás este plan y me decís si querés cambiar/agregar algo
2. Ejecutamos Fase 1 paso a paso
3. Hacés deploy a Vercel + conectás Supabase y Cloudinary
4. Testeamos juntos
5. Arrancamos Fase 2 cuando la base esté sólida
