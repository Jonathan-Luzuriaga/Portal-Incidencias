# Contexto del proyecto — Portal de Incidencias (Bago)

Documento de referencia para retomar el trabajo **sin depender del historial del chat**.  
Última actualización: junio 2026.

---

## Qué es

Dos portales web **independientes** (URLs distintas, sin enlaces cruzados), embebibles en **Notion**:

| Portal | Ruta | Audiencia |
|--------|------|-----------|
| **Cliente** | `/` | Cliente Bago — reporte de incidencias QA |
| **Equipo** | `/tareas` | Dev, PM, QA interno — creación de tareas |

### Portal cliente (`/`)

1. **Formulario manual** — campos alineados al reporte ZONALES.
2. **Subir PDF / Word** — extrae una o más incidencias del documento y crea una tarea QA por cada una.

Pipeline:

```
Cliente (formulario o documento)
  → DeepSeek (formateo / extracción)
  → Notion (subida de evidencias + creación de tarea en BD Tareas)
```

### Portal equipo (`/tareas`)

1. **Pegar descripción en bruto** → DeepSeek estructura título, tipo, prioridad, categoría, etiquetas y cuerpo markdown.
2. **Formulario manual** — campos editables tras estructurar (o llenado a mano).
3. Creación directa en Notion (sin plantilla QA de incidencias).

Pipeline:

```
Equipo (texto en bruto o formulario)
  → DeepSeek opcional (lib/deepseek-team.ts)
  → Notion (evidencias + tarea en BD Tareas)
```

**APIs externas:** solo DeepSeek y Notion. Las imágenes van directo a Notion (`fileUploads`), sin hosting intermedio.

---

## URLs para embeber en Notion

**Producción (Vercel):** https://portal-incidencias-bago.vercel.app

| Uso | URL embed |
|-----|-----------|
| **Cliente (incidencias)** | `https://portal-incidencias-bago.vercel.app` |
| **Equipo (tareas)** | `https://portal-incidencias-bago.vercel.app/tareas` |

### Parámetros opcionales

**Cliente** (`/`):

- `?proyecto=zonales` o `?proyecto=sgc` — preselecciona Proyecto Cliente.

**Equipo** (`/tareas`):

- `?proyecto=gestion|sgc|zonales` — preselecciona Proyecto Cliente.
- `?proyecto_notion=<page id>` — preselecciona proyecto en columna Proyecto (relation).

### Cómo embeber

1. En la página de Notion: `/embed` → **Embed link** (no Bookmark).
2. Pega la URL correspondiente (cliente o equipo).
3. Notion pide clic en *"Haz clic para ver contenido de..."* antes de cargar el iframe (comportamiento normal).
4. Si no carga: recarga forzada (Ctrl+Shift+R) y recrea el bloque embed.

### CSP (obligatorio para iframe)

```
Content-Security-Policy: frame-ancestors 'self' https://app.notion.com https://notion.so https://www.notion.so https://*.notion.so https://*.notion.site
```

Configurado en `next.config.ts` y `vercel.json`.  
**Importante:** `app.notion.com` no coincide con `*.notion.so`; hay que incluir ambos.

---

## Repositorios

| Repo | Rol |
|------|-----|
| **Portal-Incidencias** (este repo) | Repo de **despliegue**. Es el que importa Vercel. |
| **ai-workflows** (rama `Cliente-Incidencias`) | Origen del desarrollo; código equivalente en raíz. Cambios importantes deben replicarse o vivir solo aquí. |

- **GitHub:** https://github.com/Jonathan-Luzuriaga/Portal-Incidencias  
- **Notion cliente (embed):** [Dashboard Cliente Bago](https://app.notion.com/p/Dashboard-Cliente-Bago-3814f339cf218052aa67d8618bd8c026)

---

## Funcionalidades implementadas

### Portal cliente

#### Formulario (`components/IncidentForm.tsx`)

- Selector **Proyecto Cliente** (lista Bago en `lib/project-profiles.ts`).
- Secciones: datos generales, contexto, detalle del bug, evidencias.
- **Evidencias con pegado:** `components/EvidenceInput.tsx` — Ctrl+V para capturas.
- Fecha/hora automática (America/Guayaquil).

#### PDF / Word (`components/DocumentUploadForm.tsx`)

- Acepta `.pdf` y `.docx` (máx. 15 MB).
- DeepSeek extrae N incidencias (`lib/deepseek-extract.ts`).
- Imágenes del documento repartidas por incidencia (`lib/document-content.ts`).

#### Notion incidencias (`lib/notion.ts`)

- Etiquetas automáticas vía `getNotionTags()` — incluye `Incidencias`, `qa`, `bugs`, etc.
- Tipo de ticket por defecto: **Bug**.

### Portal equipo (`/tareas`) — ingesta PM

Flujo simplificado (4 decisiones del PM + IA):

1. **Tu idea** (texto en bruto)
2. **Proyecto** (Notion)
3. **Responsable** (persona del workspace)
4. **Tipo** — Épica | Tarea | Bug
5. Opcional: **épica/tarea padre**, **subtareas** (sugeridas por IA o manuales)

La IA estructura título, descripción, cuerpo markdown, prioridad, categoría y etiquetas.  
Detalles avanzados (PR, horas, evidencias) quedan colapsados para dev/QA.

APIs equipo:

- `GET /api/tareas/opciones?proyecto=<id>` — usuarios + tareas padre del proyecto
- `POST /api/tareas/estructurar` — preview con IA (incluye subtareas sugeridas)
- `POST /api/tareas` — crea tarea principal + subtareas enlazadas en Notion

Properties Notion adicionales (env opcional):

- `NOTION_PROP_ASSIGNEE` → `Responsable` (person)
- `NOTION_PROP_PARENT` → `Link pagina` (relation a padre)

---

## Esquema Notion (BD “Tareas”)

Base de datos compartida por ambos portales. Nombres de columna **exactos** (configurables vía env):

| Columna env | Nombre Notion | Tipo |
|-------------|---------------|------|
| `NOTION_PROP_TITLE` | `herramienta` | title |
| `NOTION_PROP_DESCRIPTION` | `Descripción` | rich_text |
| `NOTION_PROP_PRIORITY` | `Prioridad` | select (Alta, Media, Baja) |
| `NOTION_PROP_CATEGORY` | `Categoria` | multi_select |
| `NOTION_PROP_PROJECT` | `Proyecto` | relation |
| `NOTION_PROP_CLIENT` | `Cliente` | multi_select |
| `NOTION_PROP_CLIENT_PROJECT` | `Proyecto Cliente` | multi_select |
| `NOTION_PROP_TICKET_TYPE` | `Tipo` | select (Épica, Tarea, Bug) |
| `NOTION_PROP_STATUS` | `Estado` | status → **Sin empezar** |
| `NOTION_PROP_TAGS` | `Etiquetas` | multi_select |
| `NOTION_PROP_SPRINT` | `Sprint` | relation |

Sprint: auto-detecta el sprint “Actual” desde `NOTION_SPRINT_DATABASE_ID` (`lib/notion-sprint.ts`).  
`NOTION_SPRINT_RELATION_ID` solo se usa como fallback si la detección falla.  
Fechas del día: `Fecha límite`, `Fecha Inicio Real` (`lib/dates.ts`).

### Etiquetas automáticas (solo portal cliente)

`getNotionTags()` en `lib/project-profiles.ts`: `tareas`, `bugs`, `qa`, `Frontend`, `UX/UI`, **`Incidencias`** + etiqueta de proyecto.

---

## Variables de entorno

Copiar `.env.example` → `.env.local` (nunca commitear `.env.local`).

Obligatorias mínimas:

- `DEEPSEEK_API_KEY` — usada por **ambos** portales
- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- `NOTION_PROJECT_RELATION_ID` — page id del proyecto Bago (portal cliente)
- `NOTION_SPRINT_DATABASE_ID`

En **Vercel → Settings → Environment Variables** deben estar todas en Production.

---

## Estructura del código

```
app/
  page.tsx                            # Portal cliente
  tareas/page.tsx                     # Portal equipo
  api/incidencias/route.ts
  api/incidencias/documento/route.ts
  api/tareas/route.ts
  api/tareas/estructurar/route.ts
  api/tareas/opciones/route.ts

components/
  IncidentPortal.tsx
  IncidentForm.tsx
  DocumentUploadForm.tsx
  TeamTaskForm.tsx
  EvidenceInput.tsx
  SuccessPanel.tsx

lib/
  deepseek.ts                         # Formateo QA (cliente)
  deepseek-team.ts                    # Estructuración IA (equipo)
  deepseek-extract.ts
  incident-pipeline.ts
  team-pipeline.ts
  team-notion.ts
  team-notion-meta.ts
  team-notion-config.ts
  team-profiles.ts
  team-types.ts
  project-profiles.ts
  notion.ts
  notion-config.ts
  notion-sprint.ts
  notion-files.ts
  notion-blocks.ts
  notion-properties.ts
```

---

## Decisiones técnicas importantes

### Portales separados

- Sin navegación entre `/` y `/tareas`; acceso solo por URL embed.
- APIs independientes: `/api/incidencias/*` vs `/api/tareas/*`.
- Misma BD Notion y mismas env vars; lógica y etiquetas distintas.

### PDF en Vercel serverless

- **Usar `unpdf`**, no `pdf-parse` (falla con `DOMMatrix is not defined`).
- `serverExternalPackages`: `unpdf`, `mammoth`, `jszip`, `pngjs`.

### DeepSeek

- Cliente formulario: fallback con plantilla si falla.
- Cliente documento: **requiere** API key.
- Equipo: fallback con plantilla mínima si falla.

### PowerShell local

Si `npm` falla por política de ejecución: usar `npm.cmd`.

---

## Desarrollo local

```bash
cp .env.example .env.local
npm install
npm run dev
# Cliente:  http://localhost:3000
# Equipo:   http://localhost:3000/tareas
```

---

## Checklist al retomar el proyecto

- [ ] `.env.local` o Vercel con todas las variables
- [ ] Integración Notion conectada a la BD Tareas
- [ ] Embed cliente apunta a `/` en Dashboard Cliente Bago
- [ ] Embed equipo apunta a `/tareas` en página interna del equipo
- [ ] Probar incidencias (formulario + PDF) y tareas (IA + manual)

---

## Para el agente de IA

1. Lee este archivo primero.
2. Claves en `.env.local` o Vercel, nunca en git.
3. **No mezclar** flujos cliente (`/`, `Incident*`, `deepseek.ts`) con equipo (`/tareas`, `Team*`, `deepseek-team.ts`).
4. Despliegue: push a `main` → Vercel auto-deploy.
