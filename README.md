# Portal de Incidencias (embebible en Notion)

App ligera en **Next.js + TailwindCSS** para embeberse en Notion (`/embed`). El cliente llena un formulario alineado con el formato de reporte ZONALES; **DeepSeek** lo transforma en una tarea QA estructurada y **Notion** la crea en tu base de datos.

**Solo usa dos APIs externas:** DeepSeek y Notion. Las evidencias se suben directamente a Notion (File Upload API), sin servicios de hosting de imágenes.

## Pipeline

1. **Cliente** — completa el formulario (título, prioridad, contexto, pasos, evidencias).
2. **DeepSeek** — genera título `[QA] Bug: …`, descripción corta y cuerpo con secciones (🎫 REPORTE, 🚨 PRIORIDAD, ⚖ JUSTIFICACIÓN, 📍 CONTEXTO, 🔍 DETALLE, 👣 REPRODUCCIÓN, ✅ CRITERIO DE CIERRE).
3. **Notion** — sube imágenes vía `fileUploads` y crea la página con properties (Prioridad, Categoria, Etiquetas, Cliente, etc.).

## Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Descripción |
| -------- | ----------- |
| `DEEPSEEK_API_KEY` | API key de DeepSeek |
| `NOTION_API_KEY` | Token de integración interna |
| `NOTION_DATABASE_ID` | ID de la base de datos de tareas QA |
| `NOTION_PROP_*` | Nombres exactos de las columnas de Notion |
| `NOTION_DEFAULT_*` | Valores por defecto (Cliente, Proyecto, Etiquetas, etc.) |
| `NOTION_PRIORITY_*` | Mapeo Alto→Alta, Medio→Media, Bajo→Baja |

### Configuración en Notion

1. Crea una integración en https://www.notion.so/my-integrations
2. Conecta la integración a tu base de datos (Connections)
3. Verifica que existan estas properties con los valores indicados:
   - **Prioridad** (select): Alta, Media, Baja
   - **Categoria** (select): BUG Frontend (o el valor en `NOTION_DEFAULT_CATEGORY`)
   - **Etiquetas** (multi_select): Frontend, UX/UI, bugs, qa, sgc, tareas
   - **Cliente**, **Proyecto**, **Tipo de Ticket**, **Estado**, **Descripción**

## Desarrollo

```bash
npm run dev
```

## Despliegue en Vercel

1. Sube la rama `Cliente-Incidencias` a GitHub (o importa el repo en [vercel.com/new](https://vercel.com/new)).
2. En **Settings → Environment Variables**, agrega todas las variables de `.env.example` con valores reales (Production, Preview y Development).
3. Variables obligatorias mínimas: `DEEPSEEK_API_KEY`, `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `NOTION_PROJECT_RELATION_ID`.
4. Deploy. Vercel detecta Next.js automáticamente; no requiere configuración extra.
5. Copia la URL de producción (ej. `https://portal-incidencias.vercel.app`) y embebe en Notion con `/embed`.

**Importante:** nunca subas `.env.local` al repositorio. Las claves van solo en Vercel o en tu máquina local.

## Embeber en Notion

1. Despliega la app (Vercel recomendado).
2. En Notion: `/embed` → pega la URL pública.
3. Opcional: preselecciona proyecto con query param, ej. `https://tu-app.vercel.app/?proyecto=zonales` o `?proyecto=sgc`.

## Estructura

```
components/IncidentForm.tsx     # Formulario ZONALES (4 secciones)
app/api/incidencias/route.ts    # Orquestador del pipeline
lib/deepseek.ts                 # Formateo QA con plantilla del PDF
lib/notion-files.ts             # Subida de evidencias a Notion
lib/notion.ts                   # Creación de la tarea
lib/notion-config.ts            # Mapeo de properties y defaults
lib/notion-blocks.ts            # Markdown → bloques Notion
```
