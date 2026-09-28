export const providers = {
  demo: { label: "Démonstration locale", model: "", host: "Aucun envoi" },
  openai: { label: "OpenAI", model: "gpt-4.1-mini", host: "api.openai.com" },
  gemini: {
    label: "Google Gemini",
    model: "gemini-2.5-flash",
    host: "generativelanguage.googleapis.com",
  },
  claude: {
    label: "Anthropic Claude",
    model: "claude-sonnet-5",
    host: "api.anthropic.com",
  },
} as const;
export type AiProvider = keyof typeof providers;
export function savedProvider(value: string): AiProvider {
  return Object.prototype.hasOwnProperty.call(providers, value)
    ? (value as AiProvider)
    : "demo";
}
