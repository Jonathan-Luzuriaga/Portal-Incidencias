"use client";

import { useEffect, useRef } from "react";
import type { ProformaActividad, HorasCuadre } from "@/lib/proforma-types";
import { nuevaActividad } from "@/lib/proforma-types";

const fieldClasses =
  "w-full rounded border border-[#e3e2e0] bg-white px-2 py-1.5 text-sm text-[#37352f] outline-none " +
  "focus:border-[#b9b9b7] focus:ring-1 focus:ring-[#2383e2]/20";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

interface ProformaActividadesTableProps {
  actividades: ProformaActividad[];
  horasTotales: number;
  cuadre: HorasCuadre;
  sumaHoras: number;
  onChange: (actividades: ProformaActividad[]) => void;
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={fieldClasses + " resize-none overflow-hidden leading-snug"}
    />
  );
}

export function ProformaActividadesTable({
  actividades,
  horasTotales,
  cuadre,
  sumaHoras,
  onChange,
}: ProformaActividadesTableProps) {
  function updateActividad(id: string, patch: Partial<ProformaActividad>) {
    onChange(actividades.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function removeActividad(id: string) {
    onChange(actividades.filter((a) => a.id !== id));
  }

  function addFila() {
    onChange([...actividades, nuevaActividad()]);
  }

  const mensajeCuadre =
    cuadre === "excede"
      ? `Las horas sumadas (${sumaHoras}) superan las ${horasTotales} horas indicadas al inicio.`
      : cuadre === "falta"
        ? `Las horas sumadas (${sumaHoras}) no coinciden con las ${horasTotales} horas indicadas al inicio.`
        : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className={labelClasses}>Actividades</label>
        <button
          type="button"
          onClick={addFila}
          className="rounded-md border border-[#e3e2e0] bg-white px-3 py-1.5 text-xs font-medium text-[#37352f] transition hover:bg-[#f7f7f5]"
        >
          + Agregar fila
        </button>
      </div>

      {mensajeCuadre ? (
        <p className="rounded-md border border-[#f5d0d0] bg-[#fdf2f2] px-3 py-2 text-sm text-[#c4554d]" role="alert">
          {mensajeCuadre}
        </p>
      ) : horasTotales > 0 && actividades.some((a) => a.actividad.trim() || a.descripcion.trim()) ? (
        <p className="text-xs text-[#787774]">
          Horas en actividades: <span className="font-medium text-[#37352f]">{sumaHoras}</span> / {horasTotales}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-[#efefef]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[#1d2856] text-left text-xs font-semibold uppercase tracking-wide text-white">
              <th className="px-3 py-2.5">Actividad</th>
              <th className="px-3 py-2.5">Descripción</th>
              <th className="w-24 px-3 py-2.5 text-center">Horas</th>
              <th className="w-12 px-2 py-2.5" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {actividades.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[#9b9a97]">
                  Sin actividades. Usa &quot;Estructurar con IA&quot; o agrega filas manualmente.
                </td>
              </tr>
            ) : (
              actividades.map((act) => (
                <tr key={act.id} className="border-t border-[#efefef] align-top">
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={act.actividad}
                      onChange={(e) => updateActividad(act.id, { actividad: e.target.value })}
                      placeholder="Nombre corto"
                      className={fieldClasses}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <AutoResizeTextarea
                      value={act.descripcion}
                      onChange={(value) => updateActividad(act.id, { descripcion: value })}
                      placeholder="Detalle de la tarea"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={act.horas > 0 ? act.horas : ""}
                      onChange={(e) => {
                        const parsed = Number(e.target.value);
                        updateActividad(act.id, { horas: Number.isFinite(parsed) ? parsed : 0 });
                      }}
                      placeholder="0"
                      className={fieldClasses + " text-center"}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeActividad(act.id)}
                      className="rounded p-1 text-[#9b9a97] transition hover:bg-[#fdf2f2] hover:text-[#c4554d]"
                      title="Eliminar fila"
                      aria-label="Eliminar fila"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
