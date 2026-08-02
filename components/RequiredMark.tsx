/** Asterisco rojo para marcar campos obligatorios en los formularios. */
export function RequiredMark() {
  return (
    <span className="text-[#1a6999]" aria-hidden="true" title="Campo obligatorio">
      {" "}
      *
    </span>
  );
}

/** Leyenda estándar que explica el asterisco de campos obligatorios. */
export function RequiredLegend() {
  return (
    <p className="mt-1 text-xs text-[#627b8e]">
      Los campos marcados con <span className="font-bold text-[#1a6999]">*</span> son
      obligatorios.
    </p>
  );
}
