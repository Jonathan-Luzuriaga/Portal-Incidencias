/** Tarifas por hora (USD) del tarifario Manticore Labs — Rol/Encargado. */
export const TARIFAS_MANTICORE = {
  SENIOR: 25.0,
  SEMI_SENIOR: 20.0,
  JUNIOR: 16.0,
  ARQUITECTO: 35.0,
  DEVOPS: 35.0,
} as const;

export type RolEncargado = keyof typeof TARIFAS_MANTICORE;

/** @deprecated Usar `RolEncargado`. */
export type PerfilDesarrollador = RolEncargado;

export const ROLES_ENCARGADO = Object.keys(TARIFAS_MANTICORE) as RolEncargado[];

export const ROL_ENCARGADO_LABELS: Record<RolEncargado, string> = {
  SENIOR: "Desarrollador Senior",
  SEMI_SENIOR: "Semi-Senior",
  JUNIOR: "Junior",
  ARQUITECTO: "Arquitecto",
  DEVOPS: "Desarrollador DevOps",
};

export const ROL_ENCARGADO_OPTIONS: { value: RolEncargado; label: string }[] = ROLES_ENCARGADO.map(
  (value) => ({ value, label: ROL_ENCARGADO_LABELS[value] })
);

export const ROL_DEFAULT: RolEncargado = "SEMI_SENIOR";

export function tarifaDefault(rol: RolEncargado): number {
  return TARIFAS_MANTICORE[rol];
}

export function isRolEncargado(value: unknown): value is RolEncargado {
  return typeof value === "string" && value in TARIFAS_MANTICORE;
}

export function parseRolEncargado(raw: unknown, fallback: RolEncargado = ROL_DEFAULT): RolEncargado {
  const value = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  if (isRolEncargado(value)) return value;
  // Alias comunes desde IA / texto libre
  if (value.includes("ARQUITECT")) return "ARQUITECTO";
  if (value.includes("DEVOPS") || value.includes("DEV_OPS")) return "DEVOPS";
  if (value.includes("SENIOR") && !value.includes("SEMI")) return "SENIOR";
  if (value.includes("SEMI")) return "SEMI_SENIOR";
  if (value.includes("JUNIOR")) return "JUNIOR";
  return fallback;
}

export interface ResultadoProforma {
  /** Tarifa efectiva (promedio ponderado por horas) o 0 si no hay horas / garantía. */
  tarifaAplicada: number;
  subtotal: number;
  iva: number;
  total: number;
}

export interface ActividadParaCalculo {
  horas: number;
  valorHora: number;
}

const IVA_RATE = 0.15;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula subtotal, IVA (15%) y total sumando horas × valorHora por actividad.
 * Si `esGarantia` es true, fuerza montos a 0 (cotización cubierta por garantía).
 */
export function calcularProformaDesdeActividades(
  actividades: ActividadParaCalculo[],
  esGarantia = false
): ResultadoProforma {
  const horasTotales = actividades.reduce(
    (sum, a) => sum + (Number.isFinite(a.horas) && a.horas > 0 ? a.horas : 0),
    0
  );

  if (esGarantia) {
    return {
      tarifaAplicada: horasTotales > 0 ? round2(0) : 0,
      subtotal: 0,
      iva: 0,
      total: 0,
    };
  }

  const subtotal = round2(
    actividades.reduce((sum, a) => {
      const horas = Number.isFinite(a.horas) && a.horas > 0 ? a.horas : 0;
      const valor = Number.isFinite(a.valorHora) && a.valorHora >= 0 ? a.valorHora : 0;
      return sum + horas * valor;
    }, 0)
  );
  const iva = round2(subtotal * IVA_RATE);
  const total = round2(subtotal + iva);
  const tarifaAplicada = horasTotales > 0 ? round2(subtotal / horasTotales) : 0;

  return {
    tarifaAplicada,
    subtotal,
    iva,
    total,
  };
}

/**
 * @deprecated Preferir `calcularProformaDesdeActividades`.
 * Conservado para llamadas legacy con un solo rol/tarifa.
 */
export function calcularProforma(
  horas: number,
  perfil: RolEncargado,
  esGarantia = false
): ResultadoProforma {
  return calcularProformaDesdeActividades(
    [{ horas, valorHora: TARIFAS_MANTICORE[perfil] }],
    esGarantia
  );
}
