/** Properties adicionales de la BD Tareas usadas por el portal de equipo. */
export interface TeamNotionProps {
  assignee: string;
  parent: string;
}

export function getTeamNotionProps(): TeamNotionProps {
  return {
    assignee: process.env.NOTION_PROP_ASSIGNEE ?? "Responsable",
    parent: process.env.NOTION_PROP_PARENT ?? "Link pagina",
  };
}
