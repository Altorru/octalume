import {
  ArrowRight,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import AiSettings from "./AiSettings";
import type { AiSettingsState } from "../useAiSettings";

export default function Settings({
  ai,
  playerName,
  onPlayerName,
  playerStorageError,
  folderPath,
  onFolderPath,
  busy,
  scanning,
  storageError,
  onRefresh,
  onLibrary,
}: {
  ai: AiSettingsState;
  playerName: string;
  onPlayerName: (value: string) => void;
  playerStorageError: string | null;
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
              onChange={(e) => onPlayerName(e.target.value)}
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
              className="input"
              value={folderPath}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => onFolderPath(e.target.value)}
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
          <AiSettings ai={ai} busy={busy} storageError={storageError} />
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
              Données gameplay envoyées uniquement après ton accord au
              fournisseur choisi.
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
