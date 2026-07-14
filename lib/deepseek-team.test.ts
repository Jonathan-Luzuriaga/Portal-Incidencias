import { describe, expect, it } from "vitest";
import { ensureEpicTitlePrefix } from "./deepseek-team";

describe("ensureEpicTitlePrefix", () => {
  it("antepone EPIC- al título de una épica", () => {
    expect(ensureEpicTitlePrefix("Integración de pagos", "Épica")).toBe(
      "EPIC-Integración de pagos"
    );
  });

  it("no duplica el prefijo si DeepSeek ya lo devolvió", () => {
    expect(ensureEpicTitlePrefix("EPIC-Integración de pagos", "Épica")).toBe(
      "EPIC-Integración de pagos"
    );
    expect(ensureEpicTitlePrefix("epic- login SSO", "Épica")).toBe("EPIC-login SSO");
  });

  it("deja el prefijo al inicio aunque el título venga con espacios", () => {
    expect(ensureEpicTitlePrefix("  Onboarding clientes  ", "Épica")).toBe(
      "EPIC-Onboarding clientes"
    );
  });

  it("no aplica el prefijo a tareas", () => {
    expect(ensureEpicTitlePrefix("Ajustar formulario", "Tarea")).toBe("Ajustar formulario");
    expect(ensureEpicTitlePrefix("EPIC-Algo", "Tarea")).toBe("EPIC-Algo");
  });

  it("no aplica el prefijo a bugs", () => {
    expect(ensureEpicTitlePrefix("Error en login", "Bug")).toBe("Error en login");
  });

  it("respeta el máximo de 120 caracteres", () => {
    const long = "A".repeat(130);
    const result = ensureEpicTitlePrefix(long, "Épica");
    expect(result.startsWith("EPIC-")).toBe(true);
    expect(result.length).toBe(120);
  });
});
