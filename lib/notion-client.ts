import { Client } from "@notionhq/client";
import { ServiceError } from "./types";

let client: Client | null = null;

export function getNotionClient(): Client {
  if (client) return client;

  const auth = process.env.NOTION_API_KEY;
  if (!auth) {
    throw new ServiceError("Falta NOTION_API_KEY en la configuración del servidor.", 500);
  }

  client = new Client({ auth });
  return client;
}
