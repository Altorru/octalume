import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChartNoAxesCombined,
  Clock3,
  FileVideo,
  Info,
  LoaderCircle,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import type { CoachingReportData, ReplayFile } from "../types";
import CoachingReport from "./CoachingReport";
import PlayerFocus from "./PlayerFocus";
import { playerTarget } from "../player";
import { providers, type AiProvider } from "../providers";

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function ReplayDetails({
  replay,
  report,
  analyzing,
  busy,
  hasApiKey,
  provider,
  model,
  playerName,
  selectedPlayerIndex,
  onPlayerSelect,
  onBack,
  onAnalyze,
  onSettings,
}: {
  replay: ReplayFile;
  report: CoachingReportData | null;
  analyzing: boolean;
  busy: boolean;
  hasApiKey: boolean;
  provider: AiProvider;
  model: string;
  playerName: string;
  selectedPlayerIndex: number | null;
  onPlayerSelect: (index: number | null) => void;
  onBack: () => void;
  onAnalyze: (consent: boolean) => void;
  onSettings: () => void;
}) {
  const [view, setView] = useState<"overview" | "coaching">("overview");
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const consentScope = JSON.stringify([provider, model, selectedPlayerIndex]);
  const consent = consentFor === consentScope;
  const coachingHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (analyzing || report) setView("coaching");
  }, [analyzing, report]);
  useEffect(() => {
    if (view === "coaching")
      coachingHeading.current?.focus({ preventScroll: true });
  }, [view]);
  const data = replay.metadata;
  if (!data) return null;
  const target = playerTarget(data.players, selectedPlayerIndex);
  const canAnalyze = Boolean(target && (provider === "demo" || consent));
  const triggerAnalysis = () => onAnalyze(provider === "demo" || consent);
  const winningTeam =
    data.blueScore !== null &&
    data.orangeScore !== null &&
    data.blueScore !== data.orangeScore
      ? data.blueScore > data.orangeScore
        ? 0
        : 1
      : null;
  return (
    <>
      <div className="match-navigation">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Tous les matchs
        </button>
        <span className="match-file">
          <FileVideo size={14} aria-hidden="true" />
          {replay.fileName}
        </span>
      </div>
      <section className="match-hero" aria-labelledby="screen-title">
        <div className="pitch-art" aria-hidden="true">
          <div className="pitch-outline">
            <span className="pitch-half" />
            <span className="pitch-circle" />
            <span className="pitch-goal goal-left" />
            <span className="pitch-goal goal-right" />
          </div>
        </div>
        <div className="match-hero-top">
          <span className="pill">MATCH ENREGISTRÉ</span>
          <span className="hero-date">
            {data.matchDate ?? "Date du match inconnue"}
          </span>
        </div>
        <h1 id="screen-title" tabIndex={-1}>
          {data.replayName || replay.fileName}
        </h1>
        <p className="match-type">{data.gameType}</p>
        <div className="match-scoreboard" aria-label="Score du match">
          <div className="team-identity">
            <span className="team-symbol blue-symbol">B</span>
            <span>Équipe bleue</span>
            <span className="team-outcome">
              {winningTeam === 0 ? "Score le plus élevé" : "Équipe 01"}
            </span>
          </div>
          <div className="hero-score">
            <span className="blue-text">{data.blueScore ?? "—"}</span>
            <span className="hero-score-separator">:</span>
            <span className="orange-text">{data.orangeScore ?? "—"}</span>
          </div>
          <div className="team-identity">
            <span className="team-symbol orange-symbol">O</span>
            <span>Équipe orange</span>
            <span className="team-outcome">
              {winningTeam === 1 ? "Score le plus élevé" : "Équipe 02"}
            </span>
          </div>
        </div>
        <div className="match-facts">
          <span>
            <MapPin size={15} aria-hidden="true" />
            {data.mapName ?? "Carte inconnue"}
          </span>
          <span>
            <Clock3 size={15} aria-hidden="true" />
            {data.durationIsEstimate ? "≈ " : ""}
            {formatDuration(data.durationSeconds)} enregistrées
          </span>
          <span>
            <Users size={15} aria-hidden="true" />
            {data.players.length} joueurs enregistrés
          </span>
        </div>
      </section>
      <PlayerFocus
        data={data}
        playerName={playerName}
        index={selectedPlayerIndex}
        busy={busy}
        onSelect={onPlayerSelect}
        onSettings={onSettings}
      />
      {provider !== "demo" && (
        <div className="analysis-consent">
          <label>
            <input
              type="checkbox"
              checked={consent}
              disabled={busy || !target}
              onChange={(event) =>
                setConsentFor(event.target.checked ? consentScope : null)
              }
            />
            <span>
              J’autorise l’envoi des statistiques de{" "}
              <strong>{target?.name ?? "mon joueur à sélectionner"}</strong> à{" "}
              {providers[provider].label} ({model}) avec ma clé API. Cet appel
              peut être facturé par le fournisseur.
            </span>
          </label>
          <p>
            Envoi : équipe, score, buts, passes, arrêts, tirs, scores d’équipes,
            type et durée enregistrée du match. Aucun pseudo, chemin ou fichier
            replay.
          </p>
        </div>
      )}
      <div className="match-actionbar">
        <div className="match-views" aria-label="Contenu du match">
          <button
            aria-pressed={view === "overview"}
            className={view === "overview" ? "selected" : ""}
            onClick={() => setView("overview")}
          >
            <ChartNoAxesCombined size={16} aria-hidden="true" /> Vue d’ensemble
          </button>
          <button
            aria-pressed={view === "coaching"}
            className={view === "coaching" ? "selected" : ""}
            onClick={() => setView("coaching")}
          >
            <Sparkles size={16} aria-hidden="true" /> Coaching IA{" "}
            {report && <span className="status-dot" />}
          </button>
        </div>
        <button
          className="button-primary"
          onClick={hasApiKey ? triggerAnalysis : onSettings}
          disabled={busy || (hasApiKey && !canAnalyze)}
          aria-label={
            hasApiKey
              ? "Analyser cette partie"
              : "Configurer une clé pour analyser cette partie"
          }
        >
          {analyzing ? (
            <LoaderCircle
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Sparkles size={16} aria-hidden="true" />
          )}
          {analyzing
            ? "Analyse en cours…"
            : !target && hasApiKey
              ? "Choisis ton joueur"
              : !canAnalyze && hasApiKey
                ? "Autorise l’envoi ci-dessus"
                : hasApiKey
                  ? report
                    ? "Relancer l’analyse"
                    : "Analyser cette partie"
                  : "Configurer le coaching"}
        </button>
      </div>
      {view === "overview" ? (
        <div className="match-overview">
          <section className="players-panel" aria-labelledby="players-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LES CHIFFRES DU MATCH</p>
                <h2 id="players-title">Sur le terrain</h2>
              </div>
              <span className="subtle-label">Données du replay</span>
            </div>
            <div className="table-scroll">
              <table className="players-table">
                <caption className="sr-only">
                  Statistiques des joueurs enregistrées dans le replay
                </caption>
                <thead>
                  <tr>
                    {[
                      "Joueur",
                      "Score",
                      "Buts",
                      "Passes",
                      "Arrêts",
                      "Tirs",
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.players
                    .map((player, index) => ({ player, index }))
                    .sort((a, b) => (a.player.team ?? 2) - (b.player.team ?? 2))
                    .map(({ player, index }) => (
                      <tr
                        key={index}
                        className={
                          index === selectedPlayerIndex
                            ? "selected-player-row"
                            : ""
                        }
                      >
                        <th scope="row">
                          <span
                            className={`player-team ${player.team === 0 ? "blue-team" : player.team === 1 ? "orange-team" : "unknown-team"}`}
                            aria-label={
                              player.team === 0
                                ? "Équipe bleue"
                                : player.team === 1
                                  ? "Équipe orange"
                                  : "Équipe inconnue"
                            }
                          />
                          {player.name}
                          {index === selectedPlayerIndex && (
                            <span className="you-badge">TOI</span>
                          )}
                          {player.isBot && (
                            <span className="bot-badge">BOT</span>
                          )}
                        </th>
                        {[
                          player.score,
                          player.goals,
                          player.assists,
                          player.saves,
                          player.shots,
                        ].map((value, stat) => (
                          <td
                            key={stat}
                            className={stat === 0 ? "player-score" : ""}
                          >
                            {value ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!data.players.length && (
              <p className="empty-players">
                Aucune statistique joueur dans cet en-tête.
              </p>
            )}
            <p className="table-note">
              Bleu / orange : équipe du joueur. « — » : donnée non renseignée.
            </p>
          </section>
          <aside className="match-side">
            <section className="coaching-teaser">
              <span className="setting-icon">
                <Sparkles size={22} aria-hidden="true" />
              </span>
              <p className="eyebrow accent">VA PLUS LOIN</p>
              <h2>
                Le score ne dit
                <br />
                pas tout.
              </h2>
              <p>
                Transforme ce match en pistes de progression avec un rapport de
                coaching.
              </p>
              <button
                className="text-action"
                onClick={() => setView("coaching")}
              >
                Découvrir le coaching{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <span className="demo-caption">
                {provider === "demo"
                  ? "Démonstration · conseils simulés"
                  : "IA réelle · statistiques uniquement"}
              </span>
            </section>
            <section className="match-file-card">
              <h3>À propos du fichier</h3>
              <dl>
                <div>
                  <dt>Enregistré par</dt>
                  <dd>{data.recordedBy ?? "Non renseigné"}</dd>
                </div>
                <div>
                  <dt>Dernière modification</dt>
                  <dd>
                    {new Date(replay.modifiedAt * 1000).toLocaleString("fr-FR")}
                  </dd>
                </div>
                <div>
                  <dt>Taille</dt>
                  <dd>{(replay.sizeBytes / 1024 / 1024).toFixed(2)} Mio</dd>
                </div>
              </dl>
            </section>
          </aside>
          <div className="metadata-note">
            <Info size={17} aria-hidden="true" />
            <p>
              Le format est déduit des joueurs enregistrés : départs et
              remplacements peuvent modifier l’effectif. « En ligne » ne
              certifie pas un match classé.
              {data.durationIsEstimate &&
                " La durée est une estimation de l’enregistrement calculée à partir des frames."}
            </p>
          </div>
        </div>
      ) : (
        <section
          className="coaching-view"
          aria-labelledby="coaching-title"
          aria-busy={analyzing}
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow accent">DU RECUL POUR MIEUX JOUER</p>
              <h2 id="coaching-title" ref={coachingHeading} tabIndex={-1}>
                {target
                  ? `Coaching · ${target.name}`
                  : "Ton rapport de coaching"}
              </h2>
            </div>
            <span className="pill">
              {report
                ? report.isMock
                  ? "DÉMONSTRATION"
                  : `${report.provider} · ${report.model}`
                : provider === "demo"
                  ? "DÉMONSTRATION"
                  : providers[provider].label}
            </span>
          </div>
          <div role="status" aria-live="polite" className="sr-only">
            {analyzing
              ? "Analyse du match en cours."
              : report
                ? "Le rapport de coaching est disponible."
                : "Aucun rapport pour ce match."}
          </div>
          {analyzing ? (
            <div className="analysis-state">
              <div className="analysis-emblem">
                <LoaderCircle
                  size={34}
                  className="animate-spin"
                  aria-hidden="true"
                />
              </div>
              <p className="eyebrow accent">UN INSTANT DE RECUL</p>
              <h3>Préparation de ton rapport…</h3>
              <p>
                {provider === "demo"
                  ? "Le replay est validé localement. Le coaching est simulé."
                  : "Le fournisseur prépare un retour sur les statistiques de ton joueur. Cela peut prendre jusqu’à 60 secondes."}
              </p>
            </div>
          ) : report ? (
            <>
              <div className="notice notice-warning">
                <Info size={18} aria-hidden="true" />
                <p>
                  {report.isMock
                    ? "Le type de match est réel. Le score, les conseils et les métriques ci-dessous sont fictifs. Aucun appel API n’a eu lieu."
                    : `Analyse IA réelle de ${report.player.name}, limitée aux statistiques. Les conseils restent des hypothèses à vérifier ; les rotations, le boost et les actions horodatées ne sont pas observés.`}
                </p>
              </div>
              <CoachingReport report={report} />
            </>
          ) : (
            <div className="analysis-state">
              <div className="analysis-emblem">
                <Sparkles size={34} aria-hidden="true" />
              </div>
              <p className="eyebrow accent">
                UNE PARTIE. DES PISTES DE PROGRESSION.
              </p>
              <h3>Qu’est-ce que ce match peut t’apprendre ?</h3>
              <p>
                {provider === "demo"
                  ? "Essaie le parcours avec un rapport fictif, sans appel réseau."
                  : "Demande un vrai retour IA sur les statistiques de ton joueur. Aucun score global ni événement de gameplay ne sera inventé à partir de ces seuls compteurs."}
              </p>
              <button
                className="button-primary"
                onClick={hasApiKey ? triggerAnalysis : onSettings}
                disabled={busy || (hasApiKey && !canAnalyze)}
              >
                <Sparkles size={16} aria-hidden="true" />
                {hasApiKey && !target
                  ? "Sélectionne ton joueur ci-dessus"
                  : hasApiKey && !canAnalyze
                    ? "Autorise l’envoi ci-dessus"
                    : hasApiKey
                      ? "Analyser cette partie"
                      : "Configurer ma clé API"}
              </button>
              <span className="demo-caption">
                {provider === "demo"
                  ? "Aucun transfert · environ 2 secondes"
                  : `Statistiques anonymisées → ${providers[provider].host}`}
              </span>
            </div>
          )}
        </section>
      )}
    </>
  );
}
