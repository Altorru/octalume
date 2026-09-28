import type { AiProvider } from "./providers";

export type AiModel = { id: string; label: string };
export type AiConfiguration = {
  draftKey: string;
  apiKey: string;
  catalog: AiModel[];
  choice: string;
  model: string;
  error: string | null;
  notice: string | null;
};
export function emptyConfiguration(draftKey = ""): AiConfiguration {
  return {
    draftKey,
    apiKey: "",
    catalog: [],
    choice: "",
    model: "",
    error: null,
    notice: null,
  };
}
export function configurationReady(
  provider: AiProvider,
  config: AiConfiguration,
): boolean {
  return (
    provider === "demo" ||
    Boolean(
      config.apiKey &&
      config.model &&
      config.catalog.some((m) => m.id === config.model),
    )
  );
}
export function catalogConfiguration(
  key: string,
  catalog: AiModel[],
  remembered: string,
): AiConfiguration {
  return {
    ...emptyConfiguration(key),
    apiKey: key,
    catalog,
    choice: catalog.some((m) => m.id === remembered) ? remembered : "",
  };
}
export function confirmedModel(config: AiConfiguration): string | null {
  return config.apiKey && config.catalog.some((m) => m.id === config.choice)
    ? config.choice
    : null;
}
