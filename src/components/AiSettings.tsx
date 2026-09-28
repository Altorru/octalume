import { KeyRound, RefreshCw, ShieldCheck, Trash2, Check } from "lucide-react";
import { providers, type AiProvider } from "../providers";
import type { AiSettingsState } from "../useAiSettings";

export default function AiSettings({
  ai,
  busy,
  storageError,
}: {
  ai: AiSettingsState;
  busy: boolean;
  storageError: string | null;
}) {
  const disabled = busy || ai.loading;
  return (
    <section
      className="settings-card"
      aria-labelledby="api-title"
      aria-busy={ai.loading}
    >
      <div className="settings-card-heading">
        <span className="setting-icon">
          <KeyRound size={21} aria-hidden="true" />
        </span>
        <div>
          <h2 id="api-title">Le coaching IA</h2>
          <p>Ton fournisseur, ta clé, ton modèle. En trois étapes.</p>
        </div>
        <span className="pill">BYOK</span>
      </div>
      <div className="ai-setup-step">
        <label htmlFor="ai-provider" className="field-label">
          <span className="setup-step-number">1</span> Choisir le fournisseur
        </label>
        <select
          id="ai-provider"
          className="input"
          value={ai.provider}
          disabled={disabled}
          onChange={(e) => ai.changeProvider(e.target.value as AiProvider)}
        >
          {Object.entries(providers).map(([value, info]) => (
            <option key={value} value={value}>
              {info.label}
            </option>
          ))}
        </select>
      </div>
      {ai.provider !== "demo" && (
        <>
          <div className="ai-setup-step">
            <label htmlFor="api-key" className="field-label">
              <span className="setup-step-number">2</span> Enregistrer la clé
              API
            </label>
            <input
              id="api-key"
              className="input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              maxLength={4096}
              value={ai.draftKey}
              disabled={disabled || Boolean(storageError)}
              onChange={(e) => ai.changeKey(e.target.value)}
              placeholder={`Ta clé ${providers[ai.provider].label}`}
            />
            <p className="field-help">
              La clé reste en mémoire pour cette session. Ce bouton consulte
              seulement le catalogue : aucune analyse ni donnée de replay
              envoyée.
            </p>
            <div className="settings-actions">
              <button
                className="button-primary"
                disabled={
                  disabled || !ai.draftKey.trim() || Boolean(storageError)
                }
                onClick={() => void ai.saveKey()}
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                  className={ai.loading ? "animate-spin" : ""}
                />
                {ai.loading
                  ? "Récupération des modèles…"
                  : "Enregistrer et récupérer les modèles"}
              </button>
              <button
                className="button-quiet"
                onClick={ai.forgetKey}
                disabled={disabled || !ai.draftKey}
              >
                <Trash2 size={14} aria-hidden="true" /> Oublier la clé
              </button>
            </div>
          </div>
          <div className="ai-setup-step">
            <label htmlFor="ai-model" className="field-label">
              <span className="setup-step-number">3</span> Choisir et
              enregistrer le modèle
            </label>
            <select
              id="ai-model"
              className="input"
              value={ai.choice}
              disabled={disabled || !ai.catalog.length}
              onChange={(e) => ai.chooseModel(e.target.value)}
            >
              <option value="">
                {ai.catalog.length
                  ? "Choisir un modèle…"
                  : "Enregistre d’abord ta clé API"}
              </option>
              {ai.catalog.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.label === m.id ? m.id : `${m.label} · ${m.id}`}
                </option>
              ))}
            </select>
            <p className="field-help">
              {ai.catalog.length
                ? `${ai.catalog.length} modèle(s) récupéré(s). `
                : ""}
              La présence au catalogue ne garantit pas la compatibilité avec les
              sorties JSON structurées de notre analyse.
            </p>
            <button
              className="button-primary"
              disabled={disabled || !ai.choice || !ai.apiKey || ai.ready}
              onClick={ai.saveModel}
            >
              <Check size={16} aria-hidden="true" />
              {ai.ready ? "Modèle enregistré" : "Enregistrer le modèle"}
            </button>
          </div>
          <div className="key-status" role="status">
            <span className={ai.ready ? "status-dot" : "status-dot inactive"} />
            <span>
              {ai.ready
                ? `Prêt · ${ai.model}`
                : ai.apiKey
                  ? "Clé enregistrée · modèle à confirmer"
                  : "Configuration à terminer"}
            </span>
          </div>
          {ai.notice && (
            <p className="field-help" role="status">
              {ai.notice}
            </p>
          )}
          {ai.error && (
            <p role="alert" className="parse-error">
              {ai.error}
            </p>
          )}
        </>
      )}
      {storageError && (
        <p role="alert" className="parse-error">
          {storageError}
        </p>
      )}
      <div className="notice notice-warning">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>
          {ai.provider === "demo"
            ? "Mode local : aucun secret nécessaire, conseils et note fictifs."
            : `Après ton accord pour chaque match, le dossier gameplay et les métriques du joueur choisi, avec le contexte pseudonymisé des autres joueurs, sont envoyés à ${providers[ai.provider].host}. Le volume des données peut augmenter le coût de l’analyse. Aucun fichier replay ni pseudo n’est envoyé.`}
        </p>
      </div>
    </section>
  );
}
