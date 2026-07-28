"use client";

import { useEffect, useRef, useState } from "react";
import {
  ROL_DEFAULT,
  ROL_ENCARGADO_OPTIONS,
  tarifaDefault,
  type RolEncargado,
} from "@/lib/proforma-calc";
import type { ProformaActividad, HorasCuadre } from "@/lib/proforma-types";
import { nuevaActividad } from "@/lib/proforma-types";

const fieldClasses =
  "w-full rounded border border-[#e3e2e0] bg-white px-2 py-1.5 text-sm leading-snug text-[#37352f] outline-none " +
  "focus:border-[#b9b9b7] focus:ring-1 focus:ring-[#2383e2]/20";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";
const cellClasses = "px-2 py-2 align-top";
const thClasses =
  "px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-white whitespace-nowrap";

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
      className={fieldClasses + " min-h-[2.25rem] resize-none overflow-hidden"}
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
  const [rolMasivo, setRolMasivo] = useState<RolEncargado>(ROL_DEFAULT);

  function updateActividad(id: string, patch: Partial<ProformaActividad>) {
    onChange(actividades.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function removeActividad(id: string) {
    onChange(actividades.filter((a) => a.id !== id));
  }

  function addFila() {
    onChange([...actividades, nuevaActividad()]);
  }

  function aplicarRolATodas() {
    const valorHora = tarifaDefault(rolMasivo);
    onChange(actividades.map((a) => ({ ...a, rol: rolMasivo, valorHora })));
  }

  function changeRolFila(id: string, rol: RolEncargado) {
    updateActividad(id, { rol, valorHora: tarifaDefault(rol) });
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

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-[#efefef] bg-[#f7f7f5] p-3">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="rol-masivo" className="mb-1 block text-xs font-medium text-[#37352f]">
            Rol/Encargado (aplicar a todas)
          </label>
          <select
            id="rol-masivo"
            value={rolMasivo}
            onChange={(e) => setRolMasivo(e.target.value as RolEncargado)}
            className={fieldClasses}
          >
            {ROL_ENCARGADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={aplicarRolATodas}
          disabled={actividades.length === 0}
          className={
            "rounded-md border border-[#e3e2e0] bg-white px-3 py-2 text-xs font-medium text-[#37352f] transition " +
            "hover:border-[#1d2856] hover:bg-[#f7f7f5] " +
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e3e2e0] disabled:hover:bg-white"
          }
        >
          Aplicar a todas las actividades
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

      <div className="w-full overflow-x-auto rounded-lg border border-[#efefef]">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-[#1d2856]">
              <th className={`${thClasses} w-[140px] min-w-[140px]`}>Actividad</th>
              <th className={`${thClasses} w-[220px] min-w-[220px]`}>Descripción</th>
              <th className={`${thClasses} w-[150px] min-w-[150px]`}>Rol/Encargado</th>
              <th className={`${thClasses} w-[88px] min-w-[88px] text-center`}>Valor/hora</th>
              <th className={`${thClasses} w-[72px] min-w-[72px] text-center`}>Horas</th>
              <th className={`${thClasses} w-[40px] min-w-[40px] text-center`} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {actividades.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#9b9a97]">
                  Sin actividades. Usa &quot;Estructurar con IA&quot; o agrega filas manualmente.
                </td>
              </tr>
            ) : (
              actividades.map((act) => (
                <tr key={act.id} className="bg-white">
                  <td className={`${cellClasses} border-t border-[#efefef]`}>
                    <input
                      type="text"
                      value={act.actividad}
                      onChange={(e) => updateActividad(act.id, { actividad: e.target.value })}
                      placeholder="Nombre corto"
                      className={fieldClasses}
                    />
                  </td>
                  <td className={`${cellClasses} border-t border-[#efefef]`}>
                    <AutoResizeTextarea
                      value={act.descripcion}
                      onChange={(value) => updateActividad(act.id, { descripcion: value })}
                      placeholder="Detalle de la tarea"
                    />
                  </td>
                  <td className={`${cellClasses} border-t border-[#efefef]`}>
                    <select
                      value={act.rol}
                      onChange={(e) => changeRolFila(act.id, e.target.value as RolEncargado)}
                      className={fieldClasses}
                      aria-label={`Rol de ${act.actividad || "actividad"}`}
                    >
                      {ROL_ENCARGADO_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${cellClasses} border-t border-[#efefef]`}>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={Number.isFinite(act.valorHora) ? act.valorHora : ""}
                      onChange={(e) => {
                        const parsed = Number(e.target.value);
                        updateActividad(act.id, {
                          valorHora: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                        });
                      }}
                      placeholder="0"
                      className={fieldClasses + " text-center tabular-nums"}
                    />
                  </td>
                  <td className={`${cellClasses} border-t border-[#efefef]`}>
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
                      className={fieldClasses + " text-center tabular-nums"}
                    />
                  </td>
                  <td className={`${cellClasses} border-t border-[#efefef] text-center`}>
                    <button
                      type="button"
                      onClick={() => removeActividad(act.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-base leading-none text-[#9b9a97] transition hover:bg-[#fdf2f2] hover:text-[#c4554d]"
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
