const TZ = "America/Guayaquil";

/** Fecha de hoy en YYYY-MM-DD (zona Guayaquil). */
export function todayIsoDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Fecha/hora legible para el reporte. */
export function nowInGuayaquil(): string {
  return new Date().toLocaleString("es-EC", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Lista de nombres de propiedades date a rellenar con hoy (CSV en env). */
export function parseDatePropertyNames(raw: string | undefined): string[] {
  const fallback = "Fecha límite,Fecha Inicio Real";
  return (raw ?? fallback)
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}
