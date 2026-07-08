/**
 * Cálculos financieros deterministas de la propuesta.
 * Fuente de reglas: instructions/3.2_Calculos_Automaticos.md y Tarifario_Corporativo.md.
 *
 * Reglas clave:
 * - Horas por actividad = semanas × 40.
 * - Cada actividad tiene un rol responsable fijo con su tarifa/hora.
 * - Subtotal = Σ(horas × tarifa). IVA = subtotal × 0.15. Total = subtotal + IVA.
 * - "Pruebas" (tabla de precios) = costo de la línea Pruebas UAT.
 * - "Desarrollo de la solución" = subtotal − precioPruebas.
 * - Esquema de pago según subtotal SIN IVA: <5000 → 100%; 5000–15000 → 50/50; >15000 → 30/30/40.
 */
import type { CorporateActivity, CorporateFinancials, CorporatePago } from "./corporate-types";

/** Orden fijo de las 9 actividades del ciclo de vida (coincide con la plantilla). */
export const ACTIVITY_ORDER = [
  "Toma de requerimientos y diseño de Mockups",
  "Diseño técnico",
  "Desarrollo Backend",
  "Desarrollo Frontend",
  "Pruebas unitarias",
  "Pruebas UAT",
  "Despliegue",
  "Capacitación",
  "Documentación y entrega",
] as const;

/** Tarifa/hora del rol responsable de cada actividad (mismo orden que ACTIVITY_ORDER). */
const ACTIVITY_RATES = [35, 35, 25, 20, 20, 20, 35, 35, 35];

/** Índice de la actividad "Pruebas UAT" dentro del orden fijo. */
const UAT_INDEX = 5;

const HOURS_PER_WEEK = 40;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Formatea un número como moneda con separador de miles y 2 decimales (sin símbolo). */
export function formatMoney(n: number): string {
  return round2(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function computeFinancials(actividades: CorporateActivity[]): CorporateFinancials {
  // Asegura 9 posiciones aunque la IA devuelva menos.
  const semanas = ACTIVITY_ORDER.map((_, i) => {
    const v = actividades[i]?.semanas;
    return typeof v === "number" && v > 0 ? v : 0;
  });

  const actividadesHoras = semanas.map((s) => Math.round(s * HOURS_PER_WEEK));
  const costos = actividadesHoras.map((h, i) => h * ACTIVITY_RATES[i]);

  const totalHoras = actividadesHoras.reduce((a, b) => a + b, 0);
  const subtotal = round2(costos.reduce((a, b) => a + b, 0));

  const horasUat = actividadesHoras[UAT_INDEX];
  const horasDesarrollo = totalHoras - horasUat;
  const precioPruebas = round2(costos[UAT_INDEX]);
  const precioDesarrollo = round2(subtotal - precioPruebas);

  const iva = round2(subtotal * 0.15);
  const total = round2(subtotal + iva);

  const pagos = computePayments(subtotal);

  return {
    actividadesHoras,
    totalHoras,
    horasDesarrollo,
    horasUat,
    subtotal,
    iva,
    total,
    precioDesarrollo,
    precioPruebas,
    pagos,
  };
}

/**
 * Usa los valores de Notion cuando existen; solo calcula lo que falte en la propuesta.
 */
export function resolveFinancials(
  actividades: CorporateActivity[],
  fromNotion?: Partial<CorporateFinancials> | null,
  pagosFromNotion?: CorporatePago[] | null
): CorporateFinancials {
  const computed = computeFinancials(actividades);

  const actividadesHoras = actividades.map((a, i) => {
    if (typeof a.horas === "number" && a.horas > 0) return a.horas;
    return computed.actividadesHoras[i];
  });

  const hasNotionPrices =
    (fromNotion?.subtotal ?? 0) > 0 ||
    (fromNotion?.total ?? 0) > 0 ||
    (fromNotion?.precioDesarrollo ?? 0) > 0;

  if (!hasNotionPrices && !fromNotion?.totalHoras && !fromNotion?.horasDesarrollo) {
    return { ...computed, actividadesHoras };
  }

  const horasUat = fromNotion?.horasUat ?? computed.horasUat;
  const horasDesarrollo = fromNotion?.horasDesarrollo ?? computed.horasDesarrollo;
  const totalHoras =
    fromNotion?.totalHoras ??
    (horasDesarrollo + horasUat > 0 ? horasDesarrollo + horasUat : computed.totalHoras);

  const subtotal = fromNotion?.subtotal ?? computed.subtotal;
  const iva = fromNotion?.iva ?? (fromNotion?.subtotal ? round2(fromNotion.subtotal * 0.15) : computed.iva);
  const total = fromNotion?.total ?? (fromNotion?.subtotal ? round2(subtotal + iva) : computed.total);
  const precioPruebas = fromNotion?.precioPruebas ?? computed.precioPruebas;
  const precioDesarrollo =
    fromNotion?.precioDesarrollo ?? (fromNotion?.subtotal ? round2(subtotal - precioPruebas) : computed.precioDesarrollo);

  const pagos =
    pagosFromNotion && pagosFromNotion.length > 0
      ? pagosFromNotion
      : computePayments(fromNotion?.subtotal ?? subtotal);

  return {
    actividadesHoras,
    totalHoras,
    horasDesarrollo,
    horasUat,
    subtotal,
    iva,
    total,
    precioDesarrollo,
    precioPruebas,
    pagos,
  };
}

/** Determina el esquema de pagos sobre el subtotal SIN IVA. */
export function computePayments(subtotal: number): CorporatePago[] {
  if (subtotal < 5000) {
    return [{ fase: 1, hito: "Inicio de proyecto", porcentaje: 100, monto: formatMoney(subtotal) }];
  }
  if (subtotal <= 15000) {
    return [
      { fase: 1, hito: "Inicio de proyecto", porcentaje: 50, monto: formatMoney(subtotal * 0.5) },
      { fase: 2, hito: "Entrega aplicativo en desarrollo", porcentaje: 50, monto: formatMoney(subtotal * 0.5) },
    ];
  }
  return [
    { fase: 1, hito: "Inicio de proyecto", porcentaje: 30, monto: formatMoney(subtotal * 0.3) },
    { fase: 2, hito: "Entrega acta de pruebas unitarias", porcentaje: 30, monto: formatMoney(subtotal * 0.3) },
    { fase: 3, hito: "Entrega aplicativo en desarrollo", porcentaje: 40, monto: formatMoney(subtotal * 0.4) },
  ];
}
