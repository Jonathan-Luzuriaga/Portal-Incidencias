"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProformaEstructurarResponse } from "@/app/api/proformas/estructurar/route";
import { ProformaActividadesTable } from "@/components/proformas/ProformaActividadesTable";
import { ProformaLivePreview } from "@/components/proformas/ProformaLivePreview";
import { RequiredLegend, RequiredMark } from "@/components/RequiredMark";
import type { ProformaOpcionesResponse } from "@/app/api/proformas/opciones/route";
import type { ProformaPublishResponse } from "@/app/api/proformas/pdf/publish/route";
import { isEmbeddedInFrame } from "@/lib/embed-download";
import { calcularProforma, type PerfilDesarrollador } from "@/lib/proforma-calc";
import {
  formatCodigoEstimacion,
  formatCodigoProyecto,
} from "@/lib/proforma-codigos";
import {
  nuevaActividad,
  validarHorasActividades,
  type ProformaActividad,
} from "@/lib/proforma-types";

type PdfStatus = "idle" | "loading" | "published" | "error";

const fieldClasses =
  "w-full rounded-md border border-[#efefef] bg-white px-3 py-2 text-sm text-[#37352f] " +
  "shadow-[0_1px_2px_rgba(15,15,15,0.04)] outline-none transition " +
  "placeholder:text-[#9b9a97] focus:border-[#b9b9b7] focus:ring-2 focus:ring-[#2383e2]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const labelClasses = "mb-1.5 block text-sm font-medium text-[#37352f]";

const PERFIL_OPTIONS: { value: PerfilDesarrollador; label: string }[] = [
  { value: "SENIOR", label: "Senior" },
  { value: "SEMI_SENIOR", label: "Semi-Senior" },
  { value: "JUNIOR", label: "Junior" },
];

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#9b9a97]">{children}</h2>
  );
}

function PrefixedInput({
  id,
  prefix,
  value,
  onChange,
  placeholder,
  maxLength,
  preview,
}: {
  id: string;
  prefix: string;
  value: string;
  onChange: (digits: string) => void;
  placeholder: string;
  maxLength?: number;
  preview?: string;
}) {
  return (
    <div>
      <div className="flex overflow-hidden rounded-md border border-[#efefef] bg-white shadow-[0_1px_2px_rgba(15,15,15,0.04)] focus-within:border-[#b9b9b7] focus-within:ring-2 focus-within:ring-[#2383e2]/20">
        <span className="flex shrink-0 items-center border-r border-[#efefef] bg-[#f7f7f5] px-3 text-sm font-semibold text-[#37352f]">
          {prefix}
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxLength ?? 10))}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent px-3 py-2 text-sm text-[#37352f] outline-none placeholder:text-[#9b9a97]"
        />
      </div>
      {preview ? (
        <p className="mt-1 text-xs text-[#9b9a97]">
          Se guardará como <span className="font-medium text-[#37352f]">{preview}</span>
        </p>
      ) : null}
    </div>
  );
}

function mapActividadesFromApi(
  items: { actividad: string; descripcion: string; horas: number }[]
): ProformaActividad[] {
  return items.map((item) =>
    nuevaActividad({
      actividad: item.actividad,
      descripcion: item.descripcion,
      horas: item.horas,
    })
  );
}

function ensureActividadRows(current: ProformaActividad[], count: number): ProformaActividad[] {
  const n = Math.max(0, Math.min(count, 12));
  if (n === 0) return current;
  if (current.length === n) return current;
  if (current.length > n) return current.slice(0, n);
  const extra = Array.from({ length: n - current.length }, () => nuevaActividad());
  return [...current, ...extra];
}

export default function ProformasPage() {
  const [textoBruto, setTextoBruto] = useState("");
  const [numActividades, setNumActividades] = useState<number>(4);
  const [structuring, setStructuring] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("idle");
  const [pdfErrorMsg, setPdfErrorMsg] = useState("");
  const [embedded, setEmbedded] = useState(false);
  const [notionPageUrl, setNotionPageUrl] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [iaAviso, setIaAviso] = useState("");

  const [numeroProyecto, setNumeroProyecto] = useState("");
  const [numeroEstimacion, setNumeroEstimacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [horas, setHoras] = useState<number>(0);
  const [perfil, setPerfil] = useState<PerfilDesarrollador>("SEMI_SENIOR");
  const [cliente, setCliente] = useState("");
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [actividades, setActividades] = useState<ProformaActividad[]>([]);

  const codigoProyecto = formatCodigoProyecto(numeroProyecto);
  const codigoEstimacion = formatCodigoEstimacion(numeroEstimacion);

  const { cuadre, suma: sumaHoras } = useMemo(
    () => validarHorasActividades(horas, actividades),
    [horas, actividades]
  );

  const resultado = useMemo(() => {
    if (!Number.isFinite(horas) || horas <= 0) return null;
    return calcularProforma(horas, perfil);
  }, [horas, perfil]);

  const canGenerarPdf =
    codigoProyecto.length > 0 &&
    codigoEstimacion.length > 0 &&
    descripcion.trim().length > 0 &&
    cliente.trim().length > 0 &&
    horas > 0 &&
    cuadre === "ok";

  const previewDatos = useMemo(
    () => ({
      codigoProyecto: numeroProyecto,
      codigoEstimacion: numeroEstimacion,
      descripcion,
      horas,
      perfil,
      actividades,
    }),
    [numeroProyecto, numeroEstimacion, descripcion, horas, perfil, actividades]
  );

  useEffect(() => {
    setEmbedded(isEmbeddedInFrame());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingClients(true);
      setClientsError("");
      try {
        const res = await fetch("/api/proformas/opciones");
        const data = (await res.json()) as ProformaOpcionesResponse;
        if (!active) return;
        if (!res.ok || !data.ok) {
          setClientsError(data.ok ? `Error ${res.status}` : data.error);
          return;
        }
        setClientOptions(data.clients);
        if (data.clients.length === 1) {
          setCliente(data.clients[0]);
        }
      } catch {
        if (active) setClientsError("No se pudieron cargar los clientes de Notion.");
      } finally {
        if (active) setLoadingClients(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Si cambian los datos, el enlace publicado deja de ser válido.
  useEffect(() => {
    setNotionPageUrl("");
    setPdfFilename("");
    setPdfStatus((prev) => (prev === "published" ? "idle" : prev));
  }, [numeroProyecto, numeroEstimacion, descripcion, horas, perfil, actividades, cliente]);

  function handleNumActividadesChange(value: number) {
    const n = Number.isFinite(value) ? Math.max(0, Math.min(12, Math.round(value))) : 0;
    setNumActividades(n);
    if (n > 0) {
      setActividades((prev) => ensureActividadRows(prev, n));
    }
  }

  async function handleEstructurar() {
    const raw = textoBruto.trim();
    if (!raw) {
      setErrorMsg("Escribe una idea o requerimiento antes de estructurar.");
      return;
    }

    setStructuring(true);
    setErrorMsg("");
    setIaAviso("");

    try {
      const res = await fetch("/api/proformas/estructurar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoBruto: raw,
          numActividades: numActividades > 0 ? numActividades : undefined,
        }),
      });

      const data = (await res.json()) as ProformaEstructurarResponse;

      if (!res.ok || !data.ok) {
        const message = data.ok ? "No se pudo estructurar la proforma." : data.error;
        setErrorMsg(message);
        return;
      }

      setDescripcion(data.descripcion);
      setHoras(data.horasEstimadas);
      setPerfil(data.perfilSugerido);
      setActividades(mapActividadesFromApi(data.actividades));
      if (data.actividades.length > 0) {
        setNumActividades(data.actividades.length);
      }

      if (!data.redactadoPorIa) {
        setIaAviso(
          "Modo local activo: se corrigieron errores tipográficos básicos. Para redacción avanzada, agrega tu DEEPSEEK_API_KEY en .env.local y reinicia el servidor (npm run dev)."
        );
      }
    } catch {
      setErrorMsg("Error de red al contactar el servidor.");
    } finally {
      setStructuring(false);
    }
  }

  async function handleGenerarPdf() {
    if (!canGenerarPdf) return;
    setPdfErrorMsg("");
    setPdfStatus("loading");
    setNotionPageUrl("");
    setPdfFilename("");

    const actividadesPayload = actividades
      .filter((a) => a.actividad.trim() || a.descripcion.trim())
      .map(({ actividad, descripcion: desc, horas: h }) => ({
        actividad: actividad.trim(),
        descripcion: desc.trim(),
        horas: h,
      }));

    try {
      const res = await fetch("/api/proformas/pdf/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoProyecto: numeroProyecto,
          codigoEstimacion: numeroEstimacion,
          descripcion: descripcion.trim(),
          horas,
          perfil,
          cliente: cliente.trim(),
          actividades: actividadesPayload,
        }),
      });

      const data = (await res.json()) as ProformaPublishResponse;
      if (!res.ok || !data.ok) {
        setPdfErrorMsg(data.ok ? `Error ${res.status}` : data.error);
        setPdfStatus("error");
        return;
      }

      setNotionPageUrl(data.pageUrl);
      setPdfFilename(data.filename);
      setPdfStatus("published");
    } catch {
      setPdfErrorMsg("Error de red al publicar la proforma en Notion.");
      setPdfStatus("error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-[#37352f]">Proformas</h1>
        <p className="mt-1 text-sm text-[#787774]">
          Estructura el alcance con IA, edita las actividades y previsualiza el PDF en tiempo real.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Columna izquierda — controles */}
        <div className="order-1 space-y-6">
          <section className="space-y-4 rounded-lg border border-[#efefef] bg-white p-5 shadow-[0_1px_2px_rgba(15,15,15,0.04)]">
            <SectionTitle>Ingesta</SectionTitle>
            <RequiredLegend />

            <div>
              <label htmlFor="texto-bruto" className={labelClasses}>
                Idea o requerimiento del cliente
                <RequiredMark />
              </label>
              <textarea
                id="texto-bruto"
                rows={5}
                value={textoBruto}
                onChange={(e) => setTextoBruto(e.target.value)}
                placeholder="Describe el alcance, entregables o necesidad del cliente…"
                disabled={structuring}
                className={fieldClasses + " resize-y min-h-[120px]"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="num-actividades" className={labelClasses}>
                  Nº de actividades (opcional)
                </label>
                <input
                  id="num-actividades"
                  type="number"
                  min={0}
                  max={12}
                  step={1}
                  value={numActividades > 0 ? numActividades : ""}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    handleNumActividadesChange(Number.isFinite(parsed) ? parsed : 0);
                  }}
                  placeholder="4"
                  className={fieldClasses}
                />
                <p className="mt-1 text-xs text-[#9b9a97]">
                  La IA sugerirá este número de filas; también puedes agregar más manualmente.
                </p>
              </div>
            </div>

            {errorMsg ? (
              <p className="rounded-md border border-[#f5d0d0] bg-[#fdf2f2] px-3 py-2 text-sm text-[#c4554d]" role="alert">
                {errorMsg}
              </p>
            ) : null}

            {iaAviso ? (
              <p className="rounded-md border border-[#f5e6b3] bg-[#fffbeb] px-3 py-2 text-sm text-[#787774]" role="status">
                {iaAviso}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleEstructurar}
              disabled={structuring || !textoBruto.trim()}
              className={
                "inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition " +
                "bg-[#2383e2] text-white hover:bg-[#1a73d1] " +
                "disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              }
            >
              {structuring ? (
                <>
                  <Spinner />
                  Estructurando…
                </>
              ) : (
                "Estructurar con IA"
              )}
            </button>
          </section>

          <section className="space-y-4 rounded-lg border border-[#efefef] bg-white p-5 shadow-[0_1px_2px_rgba(15,15,15,0.04)]">
            <SectionTitle>Detalle de la proforma</SectionTitle>
            <RequiredLegend />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="codigo-proyecto" className={labelClasses}>
                  Código proyecto
                  <RequiredMark />
                </label>
                <PrefixedInput
                  id="codigo-proyecto"
                  prefix="PROY-"
                  value={numeroProyecto}
                  onChange={setNumeroProyecto}
                  placeholder="6871"
                  maxLength={6}
                  preview={codigoProyecto || undefined}
                />
              </div>

              <div>
                <label htmlFor="codigo-estimacion" className={labelClasses}>
                  Nº estimación
                  <RequiredMark />
                </label>
                <PrefixedInput
                  id="codigo-estimacion"
                  prefix="EST-"
                  value={numeroEstimacion}
                  onChange={setNumeroEstimacion}
                  placeholder="5"
                  maxLength={6}
                  preview={codigoEstimacion || undefined}
                />
              </div>
            </div>

            <div>
              <label htmlFor="cliente" className={labelClasses}>
                Cliente
                <RequiredMark />
              </label>
              {loadingClients ? (
                <p className="text-sm text-[#9b9a97]">Cargando clientes desde Notion…</p>
              ) : clientsError ? (
                <p className="text-sm text-[#b5403a]">{clientsError}</p>
              ) : (
                <select
                  id="cliente"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className={fieldClasses}
                  disabled={clientOptions.length === 0}
                >
                  <option value="">Selecciona un cliente</option>
                  {clientOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1.5 text-xs text-[#9b9a97]">
                Opciones tomadas de la columna Cliente en Notion.
              </p>
            </div>

            <div>
              <label htmlFor="descripcion" className={labelClasses}>
                Descripción del alcance
                <RequiredMark />
              </label>
              <textarea
                id="descripcion"
                rows={4}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Alcance y entregables (la IA sugiere este campo)"
                className={fieldClasses + " resize-y min-h-[96px]"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="horas" className={labelClasses}>
                  Horas totales
                  <RequiredMark />
                </label>
                <input
                  id="horas"
                  type="number"
                  min={1}
                  step={1}
                  value={horas > 0 ? horas : ""}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    setHoras(Number.isFinite(parsed) ? parsed : 0);
                  }}
                  placeholder="0"
                  className={fieldClasses}
                />
              </div>

              <div>
                <label htmlFor="perfil" className={labelClasses}>
                  Perfil
                  <RequiredMark />
                </label>
                <select
                  id="perfil"
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value as PerfilDesarrollador)}
                  className={fieldClasses}
                >
                  {PERFIL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ProformaActividadesTable
              actividades={actividades}
              horasTotales={horas}
              cuadre={cuadre}
              sumaHoras={sumaHoras}
              onChange={setActividades}
            />
          </section>

          <aside className="rounded-lg border border-[#efefef] bg-[#f7f7f5] p-5 shadow-[0_1px_2px_rgba(15,15,15,0.04)] lg:hidden">
            <SectionTitle>Resumen</SectionTitle>
            {resultado ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#787774]">Tarifa / hora</dt>
                  <dd className="font-medium text-[#37352f]">USD {formatUsd(resultado.tarifaAplicada)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#787774]">Subtotal</dt>
                  <dd className="font-medium text-[#37352f]">USD {formatUsd(resultado.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#787774]">IVA (15%)</dt>
                  <dd className="font-medium text-[#37352f]">USD {formatUsd(resultado.iva)}</dd>
                </div>
                <div className="border-t border-[#e8e8e8] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-[#37352f]">Total</dt>
                    <dd className="text-base font-semibold text-[#1a73d1]">USD {formatUsd(resultado.total)}</dd>
                  </div>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[#9b9a97]">
                Ingresa las horas y selecciona un perfil para ver el cálculo.
              </p>
            )}
          </aside>
        </div>

        {/* Columna derecha — previsualización (en móvil va al final) */}
        <div className="order-2 space-y-4">
          <div className="hidden rounded-lg border border-[#efefef] bg-[#f7f7f5] p-5 shadow-[0_1px_2px_rgba(15,15,15,0.04)] lg:block">
            <SectionTitle>Resumen</SectionTitle>
            {resultado ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#787774]">Tarifa / hora</dt>
                  <dd className="font-medium text-[#37352f]">USD {formatUsd(resultado.tarifaAplicada)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#787774]">Subtotal</dt>
                  <dd className="font-medium text-[#37352f]">USD {formatUsd(resultado.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#787774]">IVA (15%)</dt>
                  <dd className="font-medium text-[#37352f]">USD {formatUsd(resultado.iva)}</dd>
                </div>
                <div className="border-t border-[#e8e8e8] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-[#37352f]">Total</dt>
                    <dd className="text-base font-semibold text-[#1a73d1]">USD {formatUsd(resultado.total)}</dd>
                  </div>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[#9b9a97]">
                Ingresa las horas y selecciona un perfil para ver el cálculo.
              </p>
            )}
          </div>

          <section className="rounded-lg border border-[#efefef] bg-white p-4 shadow-[0_1px_2px_rgba(15,15,15,0.04)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-[#37352f]">Vista previa del PDF</h2>
              <span className="text-xs text-[#9b9a97]">Actualización en tiempo real</span>
            </div>

            <ProformaLivePreview datos={previewDatos} />

            {cuadre !== "ok" && horas > 0 ? (
              <p className="mt-3 rounded-md border border-[#f5d0d0] bg-[#fdf2f2] px-3 py-2 text-xs text-[#c4554d]" role="alert">
                Corrige el cuadre de horas en las actividades antes de generar el PDF.
              </p>
            ) : null}

            {embedded ? (
              <p className="mt-4 text-xs text-[#787774]">
                Notion bloquea descargas dentro del embed. El PDF se publica en tu workspace y puedes
                abrirlo con el botón de abajo.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleGenerarPdf()}
              disabled={!canGenerarPdf || structuring || pdfStatus === "loading"}
              className={
                "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition " +
                "bg-[#1d2856] text-white hover:bg-[#152040] " +
                "disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {pdfStatus === "loading" ? (
                <>
                  <Spinner />
                  Publicando en Notion…
                </>
              ) : (
                "Generar PDF"
              )}
            </button>

            {pdfStatus === "published" && notionPageUrl ? (
              <div className="mt-3 space-y-3 rounded-md border border-[#d3e5fd] bg-[#edf3fe] px-3 py-3">
                <p className="text-sm text-[#37352f]">
                  PDF publicado en Notion{pdfFilename ? ` (${pdfFilename})` : ""}. Ábrelo fuera del
                  sandbox del embed para descargarlo.
                </p>
                <a
                  href={notionPageUrl}
                  target="_top"
                  rel="noopener noreferrer"
                  className={
                    "inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition " +
                    "bg-[#2383e2] text-white hover:bg-[#1a73d1]"
                  }
                >
                  Abrir PDF en Notion
                </a>
                {!embedded ? (
                  <a
                    href={notionPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-xs font-medium text-[#2383e2] underline"
                  >
                    Abrir en pestaña nueva
                  </a>
                ) : null}
              </div>
            ) : null}

            {pdfStatus === "error" && pdfErrorMsg ? (
              <p className="mt-3 rounded-md border border-[#f5d0d0] bg-[#fdf2f2] px-3 py-2 text-xs text-[#c4554d]" role="alert">
                {pdfErrorMsg}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
