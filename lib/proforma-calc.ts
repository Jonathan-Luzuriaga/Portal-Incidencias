/** Tarifas por hora (USD) del tarifario Manticore Labs. */
export const TARIFAS_MANTICORE = {
  SENIOR: 25.0,
  SEMI_SENIOR: 20.0,
  JUNIOR: 16.0,
} as const;

export type PerfilDesarrollador = keyof typeof TARIFAS_MANTICORE;

export interface ResultadoProforma {
  tarifaAplicada: number;
  subtotal: number;
  iva: number;
  total: number;
}

const IVA_RATE = 0.15;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula subtotal, IVA (15%) y total para una proforma según horas y perfil.
 */
export function calcularProforma(horas: number, perfil: PerfilDesarrollador): ResultadoProforma {
  const tarifaAplicada = TARIFAS_MANTICORE[perfil];
  const subtotal = round2(horas * tarifaAplicada);
  const iva = round2(subtotal * IVA_RATE);
  const total = round2(subtotal + iva);

  return {
    tarifaAplicada,
    subtotal,
    iva,
    total,
  };
}
