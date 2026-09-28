import {
  ArrowRight,
  FolderOpen,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { providers, type AiProvider } from "../providers";

export default function Settings({
  apiKey,
  playerName,
  onPlayerName,
  playerStorageError,
  provider,
  onProvider,
  model,
  onModel,
  onApiKey,
  folderPath,
  onFolderPath,
  busy,
  scanning,
  storageError,
  onRefresh,
  onLibrary,
}: {
  apiKey: string;
  playerName: string;
  onPlayerName: (value: string) => void;
  playerStorageError: string | null;
  provider: AiProvider;
  onProvider: (provider: AiProvider) => void;
  model: string;
  onModel: (value: string) => void;
  onApiKey: (value: string) => void;
  folderPath: string;
  onFolderPath: (value: string) => void;
  busy: boolean;
  scanning: boolean;
  storageError: string | null;
  onRefresh: () => void;
  onLibrary: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow accent">UN ESPACE À TA MESURE</p>
          <h1 id="screen-title" tabIndex={-1}>
            Tes réglages.
          </h1>
          <p>
            Ton profil, tes replays et ton coaching. Un espace pour ton jeu.
          </p>
        </div>
      </div>
      <div className="settings-layout">
        <div className="settings-stack">
          <section className="settings-card" aria-labelledby="profile-title">
            <div className="settings-card-heading">
              <span className="setting-icon">
                <UserRound size={21} aria-hidden="true" />
              </span>
              <div>
                <h2 id="profile-title">Quel joueur es-tu ?</h2>
                <p>
                  Ton pseudo Rocket League, tel qu’il apparaît dans tes replays.
                </p>
              </div>
            </div>
            <label htmlFor="player-name" className="field-label">
              Mon pseudo en jeu
            </label>
            <input
              id="player-name"
              className="input"
              value={playerName}
              disabled={busy}
              onChange={(event) => onPlayerName(event.target.value)}
              placeholder="Ton pseudo Steam ou Epic"
              autoComplete="off"
              spellCheck={false}
              maxLength={128}
            />
            <p className="field-help">
              Mémorisé sur cet appareil. Détection uniquement si un joueur
              humain correspond exactement, sans tenir compte de la casse et des
              espaces extérieurs. Sinon, tu choisis explicitement ton joueur
              dans le match.
            </p>
            <p className="field-help">
              Un pseudo n’est pas un identifiant de compte vérifié. Aucun joueur
              n’est choisi automatiquement à partir du seul auteur du replay.
            </p>
            {playerStorageError && (
              <p role="alert" className="parse-error">
                {playerStorageError}
              </p>
            )}
          </section>
          <section className="settings-card" aria-labelledby="folder-title">
            <div className="settings-card-heading">
              <span className="setting-icon">
                <FolderOpen size={21} aria-hidden="true" />
              </span>
              <div>
                <h2 id="folder-title">Ta bibliothèque locale</h2>
                <p>
                  Le dossier dans lequel Rocket League enregistre tes replays.
                </p>
              </div>
            </div>
            <label htmlFor="replay-folder" className="field-label">
              Dossier des replays
            </label>
            <input
              id="replay-folder"
              aria-label="Dossier des replays"
              className="input"
              value={folderPath}
              disabled={busy}
              spellCheck={false}
              onChange={(event) => onFolderPath(event.target.value)}
              placeholder="Chemin vers TAGame/Demos"
            />
            <p className="field-help">
              Le chemin est mémorisé après une lecture réussie. Aucun
              sous-dossier n’est parcouru.
            </p>
            <div className="settings-actions">
              <button
                className="button-primary"
                onClick={onRefresh}
                disabled={busy || !folderPath.trim()}
              >
                <RefreshCw
                  size={16}
                  className={scanning ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                {scanning ? "Lecture en cours…" : "Lire ce dossier"}
              </button>
              <button className="button-quiet" onClick={onLibrary}>
                Voir la bibliothèque <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
          <section className="settings-card" aria-labelledby="api-title">
            <div className="settings-card-heading">
              <span className="setting-icon">
                <KeyRound size={21} aria-hidden="true" />
              </span>
              <div>
                <h2 id="api-title">Le coaching IA</h2>
                <p>
                  Ton fournisseur et ta propre clé. Aucun serveur Octalume
                  intermédiaire.
                </p>
              </div>
              <span className="pill">BYOK</span>
            </div>
            <label htmlFor="ai-provider" className="field-label">
              Fournisseur IA
            </label>
            <select
              id="ai-provider"
              className="input"
              value={provider}
              disabled={busy}
              onChange={(event) => onProvider(event.target.value as AiProvider)}
            >
              {Object.entries(providers).map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
            </select>
            <p className="field-help">
              Démonstration : aucun réseau. Fournisseur réel : appel direct et
              facturé sur ton compte API, après consentement pour chaque match.
            </p>
            {provider !== "demo" && (
              <>
                <label htmlFor="ai-model" className="field-label mt-5">
                  Modèle
                </label>
                <input
                  id="ai-model"
                  className="input"
                  value={model}
                  disabled={busy}
                  onChange={(event) => onModel(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={128}
                />
                <p className="field-help">
                  Identifiant disponible sur ton compte et compatible avec les
                  sorties JSON structurées. Les modèles proposés ne garantissent
                  pas l’accès de ton compte.
                </p>
                <label htmlFor="api-key" className="field-label mt-5">
                  Clé API
                </label>
                <input
                  id="api-key"
                  aria-label="Clé API"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  disabled={busy}
                  onChange={(event) => onApiKey(event.target.value)}
                  placeholder={`Ta clé ${providers[provider].label}`}
                  className="input"
                />
                <p className="field-help">
                  Clé conservée uniquement en mémoire pour cette session. Elle
                  n’est jamais enregistrée sur disque et reste séparée des clés
                  des autres fournisseurs.
                </p>
                <div className="key-status">
                  <span
                    className={
                      apiKey.trim() ? "status-dot" : "status-dot inactive"
                    }
                  />
                  <span>
                    {apiKey.trim()
                      ? "Clé renseignée · validation lors du premier appel"
                      : "Aucune clé renseignée"}
                  </span>
                  <button
                    className="button-quiet"
                    onClick={() => onApiKey("")}
                    disabled={!apiKey || busy}
                    aria-label="Oublier la clé API"
                  >
                    <Trash2 size={14} aria-hidden="true" /> Oublier la clé
                  </button>
                </div>
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
                {provider === "demo"
                  ? "Mode local : aucun secret nécessaire, conseils et note fictifs."
                  : `Les statistiques du joueur choisi et le contexte du match seront envoyés à ${providers[provider].host}. Aucun fichier replay ni pseudo ne sera envoyé. Les règles de conservation du fournisseur s’appliquent. La facturation API est distincte d’un abonnement à son application de chat.`}
              </p>
            </div>
          </section>
        </div>
        <aside className="settings-privacy">
          <ShieldCheck size={28} aria-hidden="true" />
          <h2>Le jeu reste le jeu.</h2>
          <p>
            Octalume lit des fichiers déjà enregistrés. Il n’interagit jamais
            avec le processus de Rocket League.
          </p>
          <ul>
            <li>Aucune injection ni lecture mémoire.</li>
            <li>Aucune surveillance du dossier.</li>
            <li>Aucun fichier replay envoyé.</li>
            <li>
              Statistiques envoyées uniquement après ton accord au fournisseur
              choisi.
            </li>
          </ul>
          <p className="privacy-disclaimer">
            Conception passive, pas une certification anti-cheat ni une garantie
            de l’éditeur.
          </p>
        </aside>
      </div>
    </>
  );
}
