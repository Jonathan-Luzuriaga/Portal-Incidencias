/** Helpers para construir properties de Notion con los tipos correctos. */

export function notionTitle(content: string) {
  return {
    title: [{ type: "text" as const, text: { content: content.slice(0, 2000) } }],
  };
}

export function notionRichText(content: string) {
  return {
    rich_text: [{ type: "text" as const, text: { content: content.slice(0, 2000) } }],
  };
}

export function notionSelect(name: string) {
  return { select: { name } };
}

export function notionStatus(name: string) {
  return { status: { name } };
}

export function notionMultiSelect(names: string[]) {
  return {
    multi_select: names.filter(Boolean).map((name) => ({ name })),
  };
}

export function notionRelation(pageIds: string[]) {
  return {
    relation: pageIds.filter(Boolean).map((id) => ({ id })),
  };
}

export function notionDate(isoDate: string) {
  return { date: { start: isoDate } };
}

export function notionNumber(value: number) {
  return { number: value };
}

export function notionUrl(url: string) {
  return { url };
}

export function parseCsvValues(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
