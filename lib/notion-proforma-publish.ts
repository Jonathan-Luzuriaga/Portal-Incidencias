import type { BlockObjectRequest, CreatePageResponse } from "@notionhq/client/build/src/api-endpoints";
import { todayIsoDate } from "./dates";
import { calcularProforma, type PerfilDesarrollador } from "./proforma-calc";
import { formatCodigoEstimacion } from "./proforma-codigos";
import { getProformaNotionConfig, notionPageUrl } from "./proforma-notion-config";
import type { ProformaActividadInput } from "./proforma-types";
import { documentFileBlocks, markdownToNotionBlocks } from "./notion-blocks";
import { getNotionClient } from "./notion-client";
import { getNotionConfig } from "./notion-config";
import { uploadBufferToNotion } from "./notion-files";
import { appendNotionChildren, splitNotionChildren } from "./notion-page-children";
import {
  notionDate,
  notionMultiSelect,
  notionPeople,
  notionRelation,
  notionRichText,
  notionSelect,
  notionStatus,
  notionTitle,
} from "./notion-properties";
import { resolveSprintIdForDate } from "./notion-sprint";
import { resolveTeamProjectRelationId } from "./team-project-relations";
import { listNotionProjects } from "./team-notion-meta";
import { normalizeTeamLabel } from "./team-profiles";
import { getTeamNotionProps } from "./team-notion-config";
import { ServiceError } from "./types";

export interface CreateProformaPdfPageArgs {
  codigoProyecto: string;
  codigoEstimacion: string;
  descripcion: string;
  horas: number;
  perfil: PerfilDesarrollador;
  actividades?: ProformaActividadInput[];
  esGarantia?: boolean;
  pdf: Buffer | Uint8Array;
  /** Valor columna Cliente (multi_select). */
  cliente?: string;
}

export interface CreateProformaPdfPageResult {
  page: CreatePageResponse;
  pageUrl: string;
  filename: string;
  fileUploadId: string;
}

function buildContextMarkdown(args: CreateProformaPdfPageArgs, totales: ReturnType<typeof calcularProforma>): string {
  const codigoEstimacion = formatCodigoEstimacion(args.codigoEstimacion) || args.codigoEstimacion;
  const actividades = (args.actividades ?? []).filter((a) => a.actividad.trim() || a.descripcion.trim());
  const esGarantia = Boolean(args.esGarantia);
  const totalLabel = esGarantia ? "Garantía" : `USD ${totales.total.toFixed(2)}`;

  const lines: string[] = [
    "## Contexto de la proforma",
    "",
    `Estimación corporativa generada desde el portal de proformas Manticore.`,
    "",
    `- **Proyecto:** ${args.codigoProyecto}`,
    `- **Estimación:** ${codigoEstimacion}`,
    `- **Garantía:** ${esGarantia ? "Sí" : "No"}`,
    `- **Perfil:** ${args.perfil}`,
    `- **Horas:** ${args.horas}`,
    `- **Subtotal:** USD ${totales.subtotal.toFixed(2)}`,
    `- **IVA (15%):** USD ${totales.iva.toFixed(2)}`,
    `- **Total:** ${totalLabel}`,
    "",
    "### Descripción",
    "",
    args.descripcion.trim() || "(Sin descripción)",
  ];

  if (actividades.length > 0) {
    lines.push("", "### Actividades", "");
    for (const a of actividades) {
      const titulo = a.actividad.trim() || "Actividad";
      const desc = a.descripcion.trim();
      lines.push(`- **${titulo}** (${a.horas}h)${desc ? ` — ${desc}` : ""}`);
    }
  }

  return lines.join("\n");
}

async function resolveProformasProjectId(configured: string): Promise<string> {
  try {
    return resolveTeamProjectRelationId(configured);
  } catch {
    // Sin UUID en env: buscar "Proformas" en la BD / esquema de proyectos.
  }

  try {
    const projects = await listNotionProjects();
    const match = projects.find(
      (p) => normalizeTeamLabel(p.label) === normalizeTeamLabel("Proformas")
    );
    if (match?.relationId) return match.relationId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.warn("[notion-proforma] No se pudo listar proyectos:", msg);
  }

  throw new ServiceError(
    'No se encontró el proyecto "Proformas" en Notion. ' +
      "Configura NOTION_PROFORMA_PROJECT_RELATION_ID con el UUID de esa página.",
    502
  );
}

/**
 * Sube el PDF a Notion y crea una tarea en la BD Tareas con el archivo adjunto.
 */
export async function createProformaPdfPage(
  args: CreateProformaPdfPageArgs
): Promise<CreateProformaPdfPageResult> {
  const config = getNotionConfig();
  const proformaCfg = getProformaNotionConfig();
  const notion = getNotionClient();
  const { props } = config;
  const today = todayIsoDate();

  const codigoEstimacion = formatCodigoEstimacion(args.codigoEstimacion) || args.codigoEstimacion.trim();
  const filename = `${args.codigoProyecto}.pdf`;
  const esGarantia = Boolean(args.esGarantia);
  const totales = calcularProforma(args.horas, args.perfil, esGarantia);
  const cliente = (args.cliente ?? "").trim() || proformaCfg.clientDefault;

  const fileUploadId = await uploadBufferToNotion(args.pdf, filename, "application/pdf");
  const projectId = await resolveProformasProjectId(proformaCfg.projectRelationId);

  const title = `Proforma${esGarantia ? " (Garantía)" : ""} — ${args.codigoProyecto} / ${codigoEstimacion}`;
  const totalLabel = esGarantia ? "Garantía" : `USD ${totales.total.toFixed(2)}`;
  const shortDescription = `${args.descripcion.trim().slice(0, 180)}${
    args.descripcion.trim().length > 180 ? "…" : ""
  } · ${args.horas}h · ${args.perfil} · ${totalLabel}`;

  const bodyBlocks: BlockObjectRequest[] = [
    ...markdownToNotionBlocks(buildContextMarkdown(args, totales)),
    ...documentFileBlocks([fileUploadId], "PDF de la proforma"),
  ];

  const properties: Record<string, unknown> = {
    [props.title]: notionTitle(title),
    [props.description]: notionRichText(shortDescription),
    [props.priority]: notionSelect(proformaCfg.prioridadDefault),
    [props.category]: notionMultiSelect(proformaCfg.categoria),
    [props.tags]: notionMultiSelect(proformaCfg.etiquetas),
    [props.project]: notionRelation([projectId]),
    [props.client]: notionMultiSelect([cliente]),
    [props.ticketType]: notionSelect(proformaCfg.ticketType),
    [props.status]: notionStatus(proformaCfg.estado),
  };

  for (const dateProp of config.datePropertyNames) {
    properties[dateProp] = notionDate(today);
  }

  // Sprint = el cuyo intervalo de fechas incluye hoy (America/Guayaquil).
  const sprintId = await resolveSprintIdForDate(today);
  if (sprintId) {
    properties[props.sprint] = notionRelation([sprintId]);
  } else {
    console.warn(
      `[notion-proforma] Sin sprint para la fecha ${today}; la tarea se crea sin relation Sprint.`
    );
  }

  if (proformaCfg.responsableIds.length > 0) {
    properties[getTeamNotionProps().assignee] = notionPeople(proformaCfg.responsableIds);
  }

  const { initial, remainder } = splitNotionChildren(bodyBlocks);

  try {
    const page = await notion.pages.create({
      parent: { database_id: config.databaseId },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      children: initial.length > 0 ? initial : undefined,
    });

    await appendNotionChildren(page.id, remainder);

    return {
      page,
      pageUrl: notionPageUrl(page.id),
      filename,
      fileUploadId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido de Notion.";
    throw new ServiceError(
      `No se pudo crear la proforma en Notion. Verifica Proyecto=Proformas, Tipo=Proforma y permisos. Detalle: ${message}`,
      502
    );
  }
}
