import { readFileSync } from "node:fs";
import type { ChatMessage } from "./types.ts";

const DEFAULT_PERSONA_URL = new URL("../config/phone-persona.md", import.meta.url);
const MAX_PERSONA_CHARS = 24_000;

export function loadPhonePersona(personaUrl: URL = DEFAULT_PERSONA_URL): ChatMessage {
  const content = readFileSync(personaUrl, "utf8").trim();
  if (!content || content.length > MAX_PERSONA_CHARS) {
    throw new Error("Invalid iScott phone persona");
  }
  return { role: "system", content };
}
