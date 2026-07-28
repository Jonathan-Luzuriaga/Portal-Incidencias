"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type IconName = "spark" | "tools" | "notion" | "gitflow" | "access" | "shield";

type SlideItem = {
  number: string;
  title: string;
  description: string;
  preview?: string;
};

type Slide = {
  eyebrow: string;
  title: string;
  description: string;
  icon: IconName;
  items: SlideItem[];
  callout: string;
  showGitflowDiagram?: boolean;
};

/* ─────────────────────────────────────────────────────
   SLIDES — máximo 5
───────────────────────────────────────────────────── */
const slides: Slide[] = [
  /* 1 — Bienvenida */
  {
    eyebrow: "Bienvenida",
    title: "Tu primer día empieza con contexto",
    description:
      "En Manticore Labs convertimos problemas complejos en soluciones simples, útiles y sostenibles. Cada integrante suma criterio, curiosidad y responsabilidad desde el primer día. Este onboarding te da el mapa completo: cómo trabajamos, qué herramientas usamos, cómo colaboramos en el código y cómo nos comunicamos. Léelo con calma y no dudes en preguntar.",
    icon: "spark",
    items: [
      {
        number: "01",
        title: "Pregunta con intención",
        description:
          "Antes de empezar cualquier tarea aclara el objetivo, el alcance, los criterios de aceptación y la fecha límite. Una pregunta bien formulada ahorra horas de trabajo mal dirigido. Si algo no está claro en Notion, pregunta antes de asumir.",
      },
      {
        number: "02",
        title: "Haz visible el avance",
        description:
          "Comunica bloqueos de forma temprana y mantén siempre actualizada la tarea en Notion. El equipo no puede ayudarte si no sabe que estás bloqueado. Registra el inicio, el progreso real y cualquier impedimento tan pronto como ocurra.",
      },
      {
        number: "03",
        title: "Entrega con calidad",
        description:
          "Valida tu trabajo antes de marcarlo como listo, documenta las decisiones técnicas y deja el código en mejor estado del que lo encontraste. La calidad no es un paso final: es una actitud en cada commit.",
      },
    ],
    callout: "Tu onboarding no es una carrera: es el mapa para avanzar con seguridad.",
  },

  /* 2 — Herramientas */
  {
    eyebrow: "Herramientas",
    title: "Las herramientas que usamos cada día",
    description:
      "En Manticore Labs cada herramienta tiene un propósito específico y no intercambiable. Notion gestiona el trabajo, Cliq centraliza la comunicación interna, OpenSpec documenta los contratos de API y Zoho Calendar coordina la disponibilidad del equipo. Usar siempre el correo @manticorelabs.com garantiza trazabilidad y seguridad en cada acceso.",
    icon: "tools",
    items: [
      {
        number: "Notion",
        title: "Gestión de tareas y documentación",
        description:
          "Fuente de verdad del equipo. Aquí viven las tareas, los criterios de aceptación, los reportes de horas y las decisiones técnicas. Todo trabajo debe estar registrado antes de empezar y cerrado con evidencia — PR enlazado — al terminar. Sin registro en Notion, la actividad no se procesa para pago.",
      },
      {
        number: "Cliq",
        title: "Comunicación interna oficial",
        description:
          "Canal oficial y único para la comunicación del equipo interno. Usa threads para responder temas específicos, menciona con @nombre solo cuando necesitas acción directa. Queda estrictamente prohibido solicitar tareas, reportar bugs o enviar requerimientos por WhatsApp, Telegram o mensajes personales.",
      },
      {
        number: "OpenSpec",
        title: "Contratos de API y especificaciones",
        description:
          "Repositorio de especificaciones técnicas y contratos de API. Antes de implementar cualquier integración, consulta OpenSpec para alinearte con los contratos definidos y evitar cambios que rompan otros servicios. Todo endpoint nuevo debe documentarse aquí antes de subirse a producción.",
      },
      {
        number: "Zoho",
        title: "Disponibilidad obligatoria",
        description:
          "Zoho Calendar es la herramienta oficial para registrar disponibilidad semanal. Cada integrante debe registrar obligatoriamente su horario para que el equipo pueda planificar reuniones, sprints y entregas con claridad.",
      },
    ],
    callout: "Correo @manticorelabs.com para todo. Cuentas personales no están permitidas en ninguna herramienta.",
  },

  /* 3 — Accesos y repositorios */
  {
    eyebrow: "Accesos",
    title: "Permisos y repositorios con trazabilidad",
    description:
      "Todo el desarrollo ocurre en repositorios privados dentro de la organización oficial de Manticore Labs en GitHub. Los accesos se otorgan con el principio de mínimo privilegio: solo lo necesario, por el canal correcto y al responsable indicado. Queda terminantemente prohibido subir credenciales o archivos .env a cualquier repositorio — usa Vault para todos los secretos.",
    icon: "access",
    items: [
      {
        number: "01",
        title: "Solicita acceso correctamente",
        description:
          "Indica la herramienta o repo, el proyecto, el nivel de permiso requerido y la razón concreta. Usa el canal interno en Cliq, etiqueta al líder o administrador y espera confirmación antes de intentar acceder. Activa MFA en cuanto recibas el acceso.",
      },
      {
        number: "02",
        title: "Vault para todos los secretos",
        description:
          "Frontend, Backend, BDD y VPN: todos los secretos deben consumirse exclusivamente desde Vault. El manejo de credenciales fuera de este flujo es una falta grave. Si accidentalmente subes información sensible, notifica al equipo de inmediato para revocar y rotar.",
      },
      {
        number: "03",
        title: "Reporte de horas y facturación",
        description:
          "Solo se aceptan horas cerradas (1h, 2h, 3h…), nunca fracciones. El pago se basa en el cruce entre el reporte de horas, la tarea en Notion y el PR en GitHub. Horas extra requieren pre-aprobación y etiqueta [EXTRA] en Notion.",
      },
    ],
    callout: "Sin registro en Notion + PR enlazado, la actividad no se factura. Privado por defecto, sin secretos en Git.",
  },

  /* 4 — Gitflow modelo de ramas */
  {
    eyebrow: "Gitflow",
    title: "Cada rama tiene un propósito claro",
    description:
      "Gitflow es el modelo de ramas que usamos para colaborar sin pisar el trabajo de otros. Define reglas claras sobre de dónde sale cada rama, a dónde va y cuándo se usa. Seguirlo garantiza que main siempre esté estable, que develop integre trabajo terminado y que cada feature, release o hotfix tenga su propio espacio controlado.",
    icon: "gitflow",
    showGitflowDiagram: true,
    items: [
      {
        number: "main",
        title: "Producción estable",
        description:
          "Solo recibe merges de release/ y hotfix/. Cada merge se etiqueta con versión semántica: v0.1, v0.2, v1.0. Nunca se trabaja directamente sobre esta rama. Representa el código que está corriendo en producción.",
      },
      {
        number: "develop",
        title: "Integración continua",
        description:
          "Rama base del equipo. Aquí se integran todas las features terminadas antes de preparar un release. Es el punto de partida para crear ramas feature/ y el destino final de cada PR aprobado.",
      },
      {
        number: "feature",
        title: "feature · release · hotfix",
        description:
          "feature/ sale de develop y regresa al terminar. release/ prepara una versión con ajustes finales y QA antes de ir a main. hotfix/ corrige bugs críticos en producción y cierra en main y develop.",
      },
    ],
    callout: "Nunca commits directos a main ni develop. Todo pasa por Pull Request. Un PR por tarea, siempre enlazado a Notion.",
  },

  /* 5 — Seguridad */
  {
    eyebrow: "Seguridad",
    title: "Protege los secretos y el código del equipo",
    description:
      "La seguridad no es opcional. Cada integrante es responsable de evitar filtraciones, proteger credenciales y usar los canales oficiales para gestionar accesos y documentación. GitHub es solo para código: nunca subas archivos de configuración sensibles.",
    icon: "shield",
    items: [
      {
        number: "01",
        title: "No subas archivos .env a GitHub",
        description:
          "Los archivos .env contienen variables de entorno con credenciales, tokens de API y configuraciones sensibles. Están incluidos en .gitignore por defecto. Si accidentalmente haces commit de un .env, notifica de inmediato al equipo para revocar y rotar todos los secretos expuestos.",
      },
      {
        number: "02",
        title: "No guardes credenciales en el código",
        description:
          "Nunca hardcodees contraseñas, tokens, API keys ni secretos en el código fuente. Usa siempre variables de entorno, Vault o el sistema oficial de secretos. Cualquier PR que contenga credenciales será rechazado automáticamente.",
      },
      {
        number: "03",
        title: "Usa Vault y .gitignore correctamente",
        description:
          "Todos los secretos deben consumirse desde Vault. Verifica que .gitignore incluya .env, .env.local, .env.production y cualquier archivo con credenciales antes de hacer push. Activa las alertas de secret scanning en GitHub para detectar filtraciones automáticamente.",
      },
    ],
    callout: "Un solo .env filtrado puede comprometer toda la infraestructura. La seguridad es responsabilidad de todos.",
  },
];

/* ─────────────────────────────────────────────────────
   DIAGRAMA GITFLOW
───────────────────────────────────────────────────── */
function GitflowDiagram() {
  return (
    <div className="my-6 overflow-x-auto rounded-2xl border border-[#1A3A6B]/15 bg-[#1A3A6B]/4 p-4">
      <svg viewBox="0 0 700 220" className="mx-auto w-full max-w-2xl" aria-label="Diagrama Gitflow" role="img">
        {[
          { y: 12, color: "#1A3A6B", label: "main" },
          { y: 42, color: "#dc2626", label: "hotfix" },
          { y: 72, color: "#0891b2", label: "release" },
          { y: 102, color: "#2E6DB4", label: "develop" },
          { y: 132, color: "#16a34a", label: "feature" },
          { y: 162, color: "#16a34a", label: "feature" },
        ].map(({ y, color, label }) => (
          <g key={`${label}-${y}`}>
            <rect x="8" y={y} width="70" height="22" rx="6" fill={color} opacity="0.9" />
            <text x="43" y={y + 15} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{label}</text>
          </g>
        ))}
        <line x1="130" y1="30" x2="670" y2="30" stroke="#1A3A6B" strokeWidth="2.5" opacity="0.25" />
        <line x1="130" y1="113" x2="670" y2="113" stroke="#2E6DB4" strokeWidth="2.5" opacity="0.25" />
        {[{ cx: 150 }, { cx: 310 }, { cx: 620 }].map(({ cx }, i) => (
          <g key={cx}>
            <circle cx={cx} cy="30" r="12" fill="#1A3A6B" />
            <text x={cx} y="34" textAnchor="middle" fontSize="8" fontWeight="800" fill="#F5C200">{["v0.1","v0.2","v1.0"][i]}</text>
          </g>
        ))}
        {[150, 230, 310, 430, 620].map((cx) => <circle key={cx} cx={cx} cy="113" r="11" fill="#2E6DB4" />)}
        <circle cx="230" cy="58" r="11" fill="#dc2626" />
        <line x1="150" y1="42" x2="210" y2="52" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="4,2" />
        <line x1="230" y1="69" x2="295" y2="105" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="4,2" />
        <line x1="230" y1="69" x2="295" y2="22" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="4,2" />
        {[230, 310, 390, 430].map((cx) => <circle key={cx} cx={cx} cy="173" r="10" fill="#16a34a" />)}
        <line x1="150" y1="124" x2="220" y2="165" stroke="#16a34a" strokeWidth="1.8" strokeDasharray="4,2" />
        <line x1="240" y1="173" x2="420" y2="173" stroke="#16a34a" strokeWidth="1.8" />
        <line x1="430" y1="163" x2="430" y2="124" stroke="#16a34a" strokeWidth="1.8" strokeDasharray="4,2" />
        {[350, 400].map((cx) => <circle key={cx} cx={cx} cy="143" r="10" fill="#16a34a" />)}
        <line x1="310" y1="124" x2="342" y2="137" stroke="#16a34a" strokeWidth="1.8" strokeDasharray="4,2" />
        <line x1="360" y1="143" x2="390" y2="143" stroke="#16a34a" strokeWidth="1.8" />
        <line x1="400" y1="133" x2="425" y2="120" stroke="#16a34a" strokeWidth="1.8" strokeDasharray="4,2" />
        {[510, 565].map((cx) => <circle key={cx} cx={cx} cy="68" r="10" fill="#0891b2" />)}
        <line x1="430" y1="102" x2="502" y2="76" stroke="#0891b2" strokeWidth="1.8" strokeDasharray="4,2" />
        <line x1="520" y1="68" x2="555" y2="68" stroke="#0891b2" strokeWidth="1.8" />
        <line x1="565" y1="58" x2="608" y2="38" stroke="#0891b2" strokeWidth="1.8" strokeDasharray="4,2" />
        <line x1="565" y1="78" x2="608" y2="105" stroke="#0891b2" strokeWidth="1.8" strokeDasharray="4,2" />
        <text x="605" y="200" fontSize="14" fontWeight="900" fill="#1A3A6B" opacity="0.1">GITFLOW</text>
      </svg>
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
        {[
          { color: "bg-[#1A3A6B]", label: "main" },
          { color: "bg-red-600",   label: "hotfix" },
          { color: "bg-cyan-600",  label: "release" },
          { color: "bg-[#2E6DB4]", label: "develop" },
          { color: "bg-green-700", label: "feature" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`inline-block size-2.5 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   MODAL VISTA PREVIA
───────────────────────────────────────────────────── */
function PreviewBadge({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#1A3A6B]/20 bg-[#1A3A6B]/5 px-2.5 py-1 text-[10px] font-semibold text-[#1A3A6B] transition hover:bg-[#1A3A6B]/10"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        Ver captura
      </button>
      {open && (
        <div
          role="dialog" aria-modal="true" aria-label="Vista previa"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[80vh] max-w-2xl w-full overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button" onClick={() => setOpen(false)}
              className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-black/10 text-slate-600 hover:bg-black/20"
              aria-label="Cerrar"
            >✕</button>
            <img src={src} alt="Vista previa" className="h-auto w-full object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────
   ÍCONOS
───────────────────────────────────────────────────── */
function SlideIcon({ name }: { name: IconName }) {
  const p = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "tools")   return <svg {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
  if (name === "notion")  return <svg {...p}><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 16V8l8 8V8"/></svg>;
  if (name === "gitflow") return <svg {...p}><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M8 6h4a4 4 0 0 1 4 4v2"/><path d="M8 18h4"/></svg>;
  if (name === "access")  return <svg {...p}><circle cx="9" cy="12" r="3.5"/><path d="M12.5 12H21"/><path d="M18 12v3"/><path d="M15 12v2"/></svg>;
  // spark
  return <svg {...p}><path d="m12 3 1.2 4.2a5 5 0 0 0 3.5 3.5L21 12l-4.3 1.2a5 5 0 0 0-3.5 3.5L12 21l-1.2-4.3a5 5 0 0 0-3.5-3.5L3 12l4.3-1.3a5 5 0 0 0 3.5-3.5L12 3Z"/></svg>;
}

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={direction === "left" ? "rotate-180" : undefined}>
      <path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────── */
export function OnboardingGuide() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slide = slides[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === slides.length - 1;

  const goBack    = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goForward = () => setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  goBack();
      if (e.key === "ArrowRight") goForward();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-5 text-slate-800 sm:px-6 sm:py-7 lg:px-10">
      <div className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-[#F5C200]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -top-36 h-[30rem] w-[30rem] rounded-full bg-[#1A3A6B]/6 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col">

        {/* HEADER */}
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl shadow-[0_6px_20px_rgba(245,194,0,0.22)]">
              <Image src="/umbording/logo_manticore.png" alt="Manticore Labs" width={56} height={56} className="object-contain" priority />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide text-[#1A3A6B]">Manticore Labs</p>
              <p className="text-xs text-slate-400">Engineering onboarding</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#1A3A6B]/15 bg-white px-4 py-2 text-xs font-semibold text-[#1A3A6B] shadow-sm sm:flex">
            <span className="size-2 rounded-full bg-[#F5C200]" />
            Guía interactiva · {slides.length} pasos
          </div>
        </header>

        {/* BODY: sidebar siempre lateral */}
        <div className="flex flex-1 gap-6 py-6 lg:gap-10 lg:py-9">

          {/* SIDEBAR — siempre columna vertical */}
          <aside className="flex w-44 shrink-0 flex-col justify-between py-1 lg:w-52 lg:py-3">
            <div>
              <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-400">
                Tu recorrido
              </p>
              <nav aria-label="Progreso del onboarding">
                <ol className="flex flex-col gap-1">
                  {slides.map((s, index) => {
                    const isActive    = index === currentIndex;
                    const isCompleted = index < currentIndex;
                    return (
                      <li key={s.eyebrow}>
                        <button
                          type="button"
                          onClick={() => setCurrentIndex(index)}
                          aria-current={isActive ? "step" : undefined}
                          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition lg:px-3 ${
                            isActive
                              ? "bg-[#1A3A6B]/8 text-[#1A3A6B]"
                              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          }`}
                        >
                          <span className={`grid size-8 shrink-0 place-items-center rounded-lg border text-xs font-bold transition ${
                            isActive
                              ? "border-[#F5C200] bg-[#F5C200] text-[#1A3A6B]"
                              : isCompleted
                                ? "border-[#1A3A6B]/25 bg-[#1A3A6B]/8 text-[#1A3A6B]"
                                : "border-slate-200 bg-white text-slate-400"
                          }`}>
                            {isCompleted ? "✓" : String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate text-xs font-medium lg:text-sm">{s.eyebrow}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>
            <p className="mt-6 text-[0.65rem] leading-5 text-slate-400">
              Usa ← → del teclado para navegar.
            </p>
          </aside>

          {/* SLIDE */}
          <section
            aria-live="polite"
            aria-labelledby="slide-title"
            className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50"
          >
            {/* Barra progreso */}
            <div className="h-1.5 w-full bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-[#1A3A6B] to-[#F5C200] transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }}
              />
            </div>

            <article key={slide.eyebrow} className="flex flex-1 flex-col p-6 sm:p-9 lg:p-12">
              {/* Ícono + contador */}
              <div className="mb-8 flex items-start justify-between gap-4">
                <div className="grid size-14 place-items-center rounded-2xl border border-[#F5C200]/35 bg-[#F5C200]/10 text-[#1A3A6B]">
                  <SlideIcon name={slide.icon} />
                </div>
                <span className="font-mono text-sm font-medium tracking-widest text-slate-300">
                  {String(currentIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
                </span>
              </div>

              {/* Eyebrow + título + descripción */}
              <div className="max-w-3xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em]" style={{ color: "#a07a08" }}>
                  {slide.eyebrow}
                </p>
                <h1 id="slide-title" className="text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#1A3A6B] sm:text-4xl lg:text-[2.75rem]">
                  {slide.title}
                </h1>
                <p className="mt-5 max-w-2xl text-pretty text-sm leading-7 text-slate-500 sm:text-base">
                  {slide.description}
                </p>
              </div>

              {/* Diagrama Gitflow opcional */}
              {slide.showGitflowDiagram && <GitflowDiagram />}

              {/* Tarjetas */}
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {slide.items.map((item) => (
                  <div
                    key={item.number}
                    className={`flex flex-col rounded-2xl border border-slate-100 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-[#1A3A6B]/18 hover:shadow-md motion-reduce:transform-none ${
                      item.number === "Zoho" ? "justify-self-center md:col-start-2" : ""
                    }`}
                  >
                    <p className="font-mono text-xs font-semibold" style={{ color: "#a07a08" }}>{item.number}</p>
                    <h2 className="mt-3 text-sm font-semibold text-[#1A3A6B]">{item.title}</h2>
                    <p className="mt-2 flex-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    {item.preview && <PreviewBadge src={item.preview} />}
                  </div>
                ))}
              </div>

              {/* Callout */}
              <div className="mt-auto pt-8">
                <div className="flex items-start gap-3 rounded-xl border-l-2 border-[#F5C200] bg-amber-50 px-4 py-3 text-sm text-[#1A3A6B]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: "#a07a08" }} />
                  <p>{slide.callout}</p>
                </div>
              </div>
            </article>

            {/* Navegación */}
            <footer className="flex items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-9 lg:px-12">
              <button
                type="button" onClick={goBack} disabled={isFirst}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-[#1A3A6B]/25 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Arrow direction="left" /> Atrás
              </button>

              <p className="hidden text-xs text-slate-400 sm:block">
                Paso {currentIndex + 1} de {slides.length}
              </p>

              <button
                type="button" onClick={goForward} disabled={isLast}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1A3A6B] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(26,58,107,0.22)] transition hover:bg-[#2E6DB4] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                Siguiente <Arrow direction="right" />
              </button>
            </footer>
          </section>
        </div>

        {/* PIE */}
        <footer className="flex items-center justify-between border-t border-slate-200 pt-4 text-[0.65rem] text-slate-400">
          <p>Uso interno · Manticore Labs</p>
          <p>Onboarding v2.0</p>
        </footer>
      </div>
    </main>
  );
}
