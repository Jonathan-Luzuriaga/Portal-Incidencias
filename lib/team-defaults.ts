import { parseCsvValues } from "./notion-properties";

/**
 * Miembros del equipo que deben aparecer siempre en responsables/revisores,
 * aunque users.list o users.retrieve de la integración Notion no los devuelva.
 */
export const KNOWN_TEAM_USERS = [
  { id: "374d872b-594c-81d6-ab2b-00020acd5315", name: "Gabriel Narváez" },
] as const;

/** IDs de usuarios que deben aparecer en responsables/revisores aunque users.list no los devuelva. */
export function getEnsuredTeamUserIds(): string[] {
  const raw =
    process.env.NOTION_TEAM_USER_IDS?.trim() ||
    process.env.NOTION_EXTRA_ASSIGNEE_IDS?.trim() ||
    "";
  const fromEnv = parseCsvValues(raw);
  const fromKnown = KNOWN_TEAM_USERS.map((u) => u.id);
  return [...new Set([...fromKnown, ...fromEnv])];
}

export function getKnownTeamUserName(id: string): string | undefined {
  return KNOWN_TEAM_USERS.find((u) => u.id === id)?.name;
}
