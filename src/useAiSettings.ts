import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { savedProvider, type AiProvider } from "./providers";
import {
  emptyConfiguration,
  configurationReady,
  catalogConfiguration,
  confirmedModel,
  type AiModel,
  type AiConfiguration,
} from "./aiConfiguration";
function read(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function useAiSettings() {
  const [provider, setProvider] = useState<AiProvider>(() =>
    savedProvider(read("octalume.aiProvider")),
  );
  const [configs, setConfigs] = useState<Record<AiProvider, AiConfiguration>>(
    () => ({
      demo: emptyConfiguration(),
      openai: emptyConfiguration(),
      gemini: emptyConfiguration(),
      claude: emptyConfiguration(),
    }),
  );
  const [loading, setLoading] = useState(false);
  const request = useRef(false);
  const generation = useRef(0);
  const config = configs[provider];
  const ready = configurationReady(provider, config);

  function update(p: AiProvider, change: Partial<AiConfiguration>) {
    setConfigs((values) => ({ ...values, [p]: { ...values[p], ...change } }));
  }
  function changeProvider(value: AiProvider) {
    if (request.current) return;
    setProvider(value);
  }
  function changeKey(value: string) {
    if (request.current) return;
    generation.current++;
    // Une clé modifiée ne peut pas utiliser le catalogue de la clé précédente.
    update(provider, emptyConfiguration(value));
  }
  function forgetKey() {
    changeKey("");
  }
  async function saveKey() {
    if (request.current || provider === "demo" || !config.draftKey.trim())
      return;
    request.current = true;
    setLoading(true);
    const p = provider;
    const version = ++generation.current;
    const key = config.draftKey.trim();
    update(p, {
      apiKey: "",
      catalog: [],
      choice: "",
      model: "",
      error: null,
      notice: null,
    });
    try {
      const catalog = await invoke<AiModel[]>("list_ai_models", {
        provider: p,
        apiKey: key,
      });
      if (version !== generation.current) return;
      if (!catalog.length) {
        update(p, {
          error:
            "Aucun modèle proposé par ce catalogue pour l’application. Vérifie les accès du compte API.",
        });
        return;
      }
      const remembered = read(`octalume.aiModel.${p}`);
      update(p, {
        ...catalogConfiguration(key, catalog, remembered),
        notice:
          "Clé enregistrée pour cette session. Choisis et enregistre maintenant ton modèle.",
      });
    } catch (cause) {
      // Seules les chaînes d'erreur expurgées du backend sont affichées, jamais une exception JS ni une requête.
      update(p, {
        error:
          typeof cause === "string"
            ? cause
            : "Impossible de récupérer les modèles. Vérifie ta clé, les permissions du compte et ta connexion, puis réessaie.",
      });
    } finally {
      request.current = false;
      setLoading(false);
    }
  }
  function chooseModel(value: string) {
    if (request.current) return;
    update(provider, { choice: value, model: "", error: null, notice: null });
  }
  function saveModel() {
    const confirmed = confirmedModel(config);
    if (request.current || !confirmed) return;
    update(provider, {
      model: confirmed,
      error: null,
      notice: "Modèle enregistré. Le coaching est prêt.",
    });
    try {
      localStorage.setItem(`octalume.aiModel.${provider}`, confirmed);
      localStorage.setItem("octalume.aiProvider", provider);
    } catch {
      update(provider, {
        notice:
          "Modèle utilisable pour cette session, mais impossible de le mémoriser sur cet appareil.",
      });
    }
  }
  return {
    ...config,
    provider,
    ready,
    loading,
    changeProvider,
    changeKey,
    forgetKey,
    saveKey,
    chooseModel,
    saveModel,
  };
}

export type AiSettingsState = ReturnType<typeof useAiSettings>;
