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
import { resolveCurrentSprintId } from "./notion-sprint";
import { resolveTeamProjectRelationId } from "./team-project-relations";
import { getTeamNotionProps } from "./team-notion-config";
import { ServiceError } from "./types";

export interface CreateProformaPdfPageArgs {
  codigoProyecto: string;
  codigoEstimacion: string;
  descripcion: string;
  horas: number;
  perfil: PerfilDesarrollador;
  actividades?: ProformaActividadInput[];
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

  const lines: string[] = [
    "## Contexto de la proforma",
    "",
    `Estimación corporativa generada desde el portal de proformas Manticore.`,
    "",
    `- **Proyecto:** ${args.codigoProyecto}`,
    `- **Estimación:** ${codigoEstimacion}`,
    `- **Perfil:** ${args.perfil}`,
    `- **Horas:** ${args.horas}`,
    `- **Subtotal:** USD ${totales.subtotal.toFixed(2)}`,
    `- **IVA (15%):** USD ${totales.iva.toFixed(2)}`,
    `- **Total:** USD ${totales.total.toFixed(2)}`,
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
  const totales = calcularProforma(args.horas, args.perfil);
  const cliente = (args.cliente ?? "").trim() || proformaCfg.clientDefault;

  const fileUploadId = await uploadBufferToNotion(args.pdf, filename, "application/pdf");

  const title = `Proforma — ${args.codigoProyecto} / ${codigoEstimacion}`;
  const shortDescription = `${args.descripcion.trim().slice(0, 180)}${
    args.descripcion.trim().length > 180 ? "…" : ""
  } · ${args.horas}h · ${args.perfil} · USD ${totales.total.toFixed(2)}`;

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
    [props.project]: notionRelation([resolveTeamProjectRelationId(proformaCfg.projectRelationId)]),
    [props.client]: notionMultiSelect([cliente]),
    [props.ticketType]: notionSelect(proformaCfg.ticketType),
    [props.status]: notionStatus(proformaCfg.estado),
  };

  for (const dateProp of config.datePropertyNames) {
    properties[dateProp] = notionDate(today);
  }

  const sprintId = await resolveCurrentSprintId();
  if (sprintId) {
    properties[props.sprint] = notionRelation([sprintId]);
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
      `No se pudo crear la proforma en Notion. Verifica Proyecto/Categoria/Etiquetas y permisos. Detalle: ${message}`,
      502
    );
  }
}
