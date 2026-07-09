/** Normaliza el número de proyecto → PROY-6871 */
export function formatCodigoProyecto(numero: string): string {
  const digits = numero.replace(/^PROY-?/i, "").replace(/\D/g, "");
  return digits ? `PROY-${digits}` : "";
}

/** Normaliza el número de estimación → EST-000005 */
export function formatCodigoEstimacion(numero: string): string {
  const raw = numero.replace(/^EST-?/i, "").replace(/\D/g, "");
  return raw ? `EST-${raw.padStart(6, "0")}` : "";
}

/** Solo dígitos visibles en el input (sin prefijo). */
export function stripPrefijoProyecto(value: string): string {
  return value.replace(/^PROY-?/i, "").replace(/\D/g, "");
}

export function stripPrefijoEstimacion(value: string): string {
  return value.replace(/^EST-?/i, "").replace(/\D/g, "");
}
