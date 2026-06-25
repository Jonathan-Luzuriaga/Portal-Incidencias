import { parseCsvValues } from "./notion-properties";

/**
 * IDs de usuarios que deben aparecer en responsables/revisores aunque users.list no los devuelva.
 * Configura NOTION_EXTRA_ASSIGNEE_IDS o NOTION_TEAM_USER_IDS (CSV de UUIDs de Notion).
 */
export function getEnsuredTeamUserIds(): string[] {
  const raw =
    process.env.NOTION_TEAM_USER_IDS?.trim() ||
    process.env.NOTION_EXTRA_ASSIGNEE_IDS?.trim() ||
    "";
  return parseCsvValues(raw);
}
