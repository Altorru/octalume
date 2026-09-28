import {
  ArrowRight,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileVideo,
  FolderOpen,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { ReplayFile } from "../types";
import { formatDuration } from "./ReplayDetails";

export type ReplayFilter = "all" | "ready" | "invalid";

export default function ReplayLibrary({
  replays,
  scanning,
  busy,
  lastScan,
  folderPath,
  hasError,
  query,
  filter,
  onQuery,
  onFilter,
  onRefresh,
  onSettings,
  onOpen,
}: {
  replays: ReplayFile[];
  scanning: boolean;
  busy: boolean;
  lastScan: Date | null;
  folderPath: string;
  hasError: boolean;
  query: string;
  filter: ReplayFilter;
  onQuery: (value: string) => void;
  onFilter: (value: ReplayFilter) => void;
  onRefresh: () => void;
  onSettings: () => void;
  onOpen: (replay: ReplayFile) => void;
}) {
  const valid = (replay: ReplayFile) =>
    Boolean(replay.metadata && !replay.parseError);
  const ready = replays.filter(valid).length;
  const visible = replays.filter((replay) => {
    const text = [
      replay.fileName,
      replay.metadata?.replayName,
      replay.gameType,
      replay.metadata?.mapName,
      ...(replay.metadata?.players.map((player) => player.name) ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase("fr");
    return (
      text.includes(query.trim().toLocaleLowerCase("fr")) &&
      (filter === "all" ||
        (filter === "ready" ? valid(replay) : !valid(replay)))
    );
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow accent">LE PROCHAIN NIVEAU COMMENCE ICI</p>
          <h1 id="screen-title" tabIndex={-1}>
            Tes matchs. Un nouveau regard.
          </h1>
          <p>
            Explore tes replays, comprends tes décisions et prépare la prochaine
            partie.
          </p>
        </div>
        <button
          className="button-primary"
          onClick={onRefresh}
          disabled={busy || !folderPath.trim()}
          aria-label="Rafraîchir la liste des replays"
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={scanning ? "animate-spin" : ""}
          />
          {scanning ? "Lecture en cours…" : "Rafraîchir la liste"}
        </button>
      </div>
      <section className="library-intro" aria-label="Résumé de la bibliothèque">
        <div className="intro-copy">
          <span className="pill">DE LA PARTIE À LA PROGRESSION</span>
          <h2>
            Revois le match.
            <br />
            <span>Pas seulement le résultat.</span>
          </h2>
          <p>
            Les statistiques racontent ce qui s’est passé.
            <br />
            Le coaching t’aide à décider de la suite.
          </p>
          <button className="text-action" onClick={onSettings}>
            Configurer mon espace <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="intro-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-ring ring-three" />
          <div className="orbit-core">
            <span>O</span>
          </div>
          <span className="orbit-caption">READ. REFLECT. REPLAY.</span>
        </div>
        <div className="library-stat">
          <span className="eyebrow">REPLAYS DISPONIBLES</span>
          <strong>{scanning ? "—" : ready.toString().padStart(2, "0")}</strong>
          <span>
            {replays.length - ready > 0
              ? `${replays.length - ready} fichier(s) à vérifier`
              : "Prêts à explorer"}
          </span>
          <div className="last-read">
            <Clock3 size={14} aria-hidden="true" />
            {scanning
              ? "Lecture du dossier…"
              : lastScan
                ? `Lu à ${lastScan.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : "Aucune lecture effectuée"}
          </div>
        </div>
      </section>
      <section
        className="library-section"
        aria-labelledby="library-title"
        aria-busy={scanning}
      >
        <div className="section-heading">
          <div>
            <h2 id="library-title">
              Bibliothèque de replays{" "}
              <span className="count-badge">{replays.length}</span>
            </h2>
            <p>Les fichiers récemment modifiés apparaissent en premier.</p>
          </div>
          <button className="button-quiet" onClick={onSettings}>
            <SlidersHorizontal size={16} aria-hidden="true" /> Gérer le dossier
          </button>
        </div>
        <div className="library-toolbar">
          <div className="filter-group" aria-label="Filtrer les replays">
            {(
              [
                { key: "all", label: "Tous les matchs", count: replays.length },
                { key: "ready", label: "Disponibles", count: ready },
                {
                  key: "invalid",
                  label: "À vérifier",
                  count: replays.length - ready,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                aria-pressed={filter === item.key}
                className={filter === item.key ? "selected" : ""}
                onClick={() => onFilter(item.key)}
              >
                {item.label}
                <span>{item.count}</span>
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">
              Rechercher un replay, une carte ou un joueur
            </span>
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Rechercher un match…"
              type="search"
            />
          </label>
        </div>
        <div className="replay-list">
          {visible.map((replay) => (
            <article
              className={`replay-row ${!valid(replay) ? "invalid-row" : ""}`}
              key={replay.filePath}
            >
              <span className="replay-icon" aria-hidden="true">
                {valid(replay) ? (
                  <FileVideo size={22} />
                ) : (
                  <CircleAlert size={22} />
                )}
              </span>
              <div className="replay-description">
                <h3>{replay.metadata?.replayName || replay.fileName}</h3>
                <div className="replay-meta">
                  <span>{replay.gameType ?? "Fichier illisible"}</span>
                  <span className="meta-dot">·</span>
                  <span>
                    {new Date(replay.modifiedAt * 1000).toLocaleDateString(
                      "fr-FR",
                      { day: "2-digit", month: "short", year: "numeric" },
                    )}{" "}
                    <span className="date-source">(fichier)</span>
                  </span>
                  <span className="meta-dot">·</span>
                  <span>{(replay.sizeBytes / 1024 / 1024).toFixed(1)} Mio</span>
                </div>
                {replay.parseError && (
                  <p className="parse-error">{replay.parseError}</p>
                )}
              </div>
              <div className="replay-result">
                {replay.metadata ? (
                  <>
                    <div
                      className="mini-score"
                      aria-label={`Score : équipe bleue ${replay.metadata.blueScore ?? "inconnu"}, équipe orange ${replay.metadata.orangeScore ?? "inconnu"}`}
                    >
                      <span className="blue-text">
                        {replay.metadata.blueScore ?? "—"}
                      </span>
                      <span className="score-divider">:</span>
                      <span className="orange-text">
                        {replay.metadata.orangeScore ?? "—"}
                      </span>
                    </div>
                    <span className="replay-duration">
                      {replay.metadata.durationIsEstimate ? "≈ " : ""}
                      {formatDuration(replay.metadata.durationSeconds)}
                    </span>
                  </>
                ) : (
                  <span className="error-badge">À vérifier</span>
                )}
              </div>
              <button
                className="button-secondary replay-open"
                onClick={() => onOpen(replay)}
                disabled={!valid(replay) || scanning}
                aria-label={`Détails du match ${replay.metadata?.replayName || replay.fileName}`}
              >
                Détails <ChevronRight size={16} aria-hidden="true" />
              </button>
            </article>
          ))}
          {visible.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">
                {scanning ? (
                  <RefreshCw
                    size={27}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <FolderOpen size={27} aria-hidden="true" />
                )}
              </span>
              <h3>
                {scanning
                  ? "On ouvre ta bibliothèque…"
                  : replays.length
                    ? "Aucun match ne correspond"
                    : hasError
                      ? "Vérifie ton dossier de replays"
                      : "Tout commence avec un replay"}
              </h3>
              <p>
                {scanning
                  ? "Une lecture locale, sans surveillance en arrière-plan."
                  : replays.length
                    ? "Essaie un autre terme ou affiche tous les matchs."
                    : "Choisis le dossier de tes replays Rocket League dans les réglages, puis rafraîchis la liste."}
              </p>
              {!scanning &&
                (replays.length ? (
                  <button
                    className="button-secondary"
                    onClick={() => {
                      onQuery("");
                      onFilter("all");
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                ) : (
                  <button className="button-primary" onClick={onSettings}>
                    Configurer le dossier{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ))}
            </div>
          )}
        </div>
        <p className="library-footnote">
          <span className="status-dot" aria-hidden="true" /> Lecture au
          lancement et au clic sur « Rafraîchir ». Rien ne tourne en
          arrière-plan.
        </p>
      </section>
    </>
  );
}
