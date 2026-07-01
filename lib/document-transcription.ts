const INCIDENT_MARKER_RE = /INCIDENCIA\s*#?\s*0*(\d+)/gi;

const FIELD_LABEL_MAP: Record<string, string> = {
  titulo: "Título",
  prioridad: "Prioridad",
  "justificación / descripción": "Justificación / descripción",
  "justificacion / descripcion": "Justificación / descripción",
  ambiente: "Ambiente",
  "fecha / hora": "Fecha / hora",
  "fecha/hora": "Fecha / hora",
  "usuario / rol": "Usuario / rol",
  "usuario/rol": "Usuario / rol",
  "módulo / url": "Módulo / url",
  "modulo / url": "Módulo / url",
  "navegador / dispositivo": "Navegador / Dispositivo",
  "id / registro afectado": "Id / registro afectado",
  resumen: "Resumen",
  "resultado actual (pasos)": "Resultado actual (pasos)",
  "resultado esperado": "Resultado esperado",
  evidencias: "Evidencias",
};

export interface ParsedDocumentIncident {
  number: string;
  markdown: string;
  evidenceCaptions: string[];
}

function normalizeLabel(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ");
}

function resolveFieldLabel(line: string): string | null {
  const key = normalizeLabel(line);
  return FIELD_LABEL_MAP[key] ?? null;
}

function isEvidenceImageLine(line: string): boolean {
  return /^imagen\s+\d+/i.test(line.trim());
}

function extractEvidenceCaptions(lines: string[]): string[] {
  const captions: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!isEvidenceImageLine(trimmed)) continue;
    captions.push(trimmed.replace(/:$/, "").trim());
  }
  return captions;
}

function parseIncidentLines(lines: string[]): {
  fields: Array<{ label: string; value: string }>;
  evidenceCaptions: string[];
} {
  const fields: Array<{ label: string; value: string }> = [];
  const evidenceCaptions = extractEvidenceCaptions(lines);

  let currentLabel: string | null = null;
  let valueLines: string[] = [];
  let inEvidence = false;

  function flushField() {
    if (!currentLabel || inEvidence) return;
    const value = valueLines.join("\n").trim();
    if (value) fields.push({ label: currentLabel, value });
    valueLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^0*\d{1,3}$/.test(line)) continue;

    const label = resolveFieldLabel(line);
    if (label === "Evidencias") {
      flushField();
      inEvidence = true;
      currentLabel = null;
      continue;
    }

    if (inEvidence) {
      if (isEvidenceImageLine(line)) continue;
      continue;
    }

    if (label) {
      flushField();
      currentLabel = label;
      continue;
    }

    if (currentLabel) {
      valueLines.push(line);
    }
  }

  flushField();
  return { fields, evidenceCaptions };
}

function formatFieldMarkdown(label: string, value: string): string {
  const multiLine =
    label === "Resultado actual (pasos)" ||
    value.includes("\n") ||
    /^\d+[\.)]\s/m.test(value);

  if (multiLine) {
    return `**${label}:**\n${value}`;
  }
  return `**${label}:** ${value}`;
}

function sectionToMarkdown(number: string, fields: Array<{ label: string; value: string }>): string {
  const body = fields.map((f) => formatFieldMarkdown(f.label, f.value)).join("\n\n");
  return `## INCIDENCIA ${number}\n\n${body}`.trimEnd();
}

/** Divide el texto del documento en secciones por marcador INCIDENCIA 001, 002… */
export function parseDocumentIncidents(rawText: string): ParsedDocumentIncident[] {
  const text = rawText.trim();
  if (!text) return [];

  const markers: Array<{ number: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(INCIDENT_MARKER_RE.source, "gi");

  while ((match = re.exec(text)) !== null) {
    const number = (match[1] ?? "1").padStart(3, "0");
    markers.push({ number, start: match.index, end: match.index + match[0].length });
  }

  if (markers.length === 0) {
    const lines = text.split(/\r?\n/);
    const { fields, evidenceCaptions } = parseIncidentLines(lines);
    return [
      {
        number: "001",
        markdown: fields.length > 0 ? sectionToMarkdown("001", fields) : text,
        evidenceCaptions,
      },
    ];
  }

  return markers.map((marker, index) => {
    const nextStart = markers[index + 1]?.start ?? text.length;
    const sectionText = text.slice(marker.end, nextStart).trim();
    const lines = sectionText.split(/\r?\n/);
    const { fields, evidenceCaptions } = parseIncidentLines(lines);

    return {
      number: marker.number,
      markdown:
        fields.length > 0
          ? sectionToMarkdown(marker.number, fields)
          : `## INCIDENCIA ${marker.number}\n\n${sectionText}`,
      evidenceCaptions,
    };
  });
}
