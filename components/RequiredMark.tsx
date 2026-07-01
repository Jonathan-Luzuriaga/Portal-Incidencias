/** Asterisco rojo para marcar campos obligatorios en los formularios. */
export function RequiredMark() {
  return (
    <span className="text-[#eb5757]" aria-hidden="true" title="Campo obligatorio">
      {" "}
      *
    </span>
  );
}

/** Leyenda estándar que explica el asterisco de campos obligatorios. */
export function RequiredLegend() {
  return (
    <p className="text-xs text-[#9b9a97]">
      Los campos marcados con <span className="text-[#eb5757]">*</span> son
      obligatorios.
    </p>
  );
}
