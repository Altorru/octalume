export const providers = {
  demo: { label: "Démonstration locale", host: "Aucun envoi" },
  openai: { label: "OpenAI", host: "api.openai.com" },
  gemini: {
    label: "Google Gemini",
    host: "generativelanguage.googleapis.com",
  },
  claude: {
    label: "Anthropic Claude",
    host: "api.anthropic.com",
  },
} as const;
export type AiProvider = keyof typeof providers;
export function savedProvider(value: string): AiProvider {
  return Object.prototype.hasOwnProperty.call(providers, value)
    ? (value as AiProvider)
    : "demo";
}
