import { X } from "lucide-react";
import type { ReplayFile } from "../types";

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function ReplayDetails({
  replay,
  onClose,
}: {
  replay: ReplayFile;
  onClose: () => void;
}) {
  const data = replay.metadata;
  if (!data) return null;

  return (
    <section
      className="panel overflow-hidden"
      aria-labelledby="match-details-title"
    >
      <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
        <div>
          <h2 id="match-details-title" className="text-lg font-semibold">
            Détails du match
          </h2>
          <p className="mt-1 break-all text-sm text-slate-400">
            {data.replayName || replay.fileName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les détails du match"
          className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <dl className="grid grid-cols-2 gap-5 p-5 lg:grid-cols-4">
        <div>
          <dt className="eyebrow">GAME TYPE</dt>
          <dd className="mt-2 text-sm">{data.gameType}</dd>
        </div>
        <div>
          <dt className="eyebrow">SCORE BLEU / ORANGE</dt>
          <dd className="mt-2 text-xl font-semibold">
            <span className="text-sky-300">{data.blueScore ?? "—"}</span>{" "}
            <span className="text-slate-600">/</span>{" "}
            <span className="text-orange-300">{data.orangeScore ?? "—"}</span>
          </dd>
        </div>
        <div>
          <dt className="eyebrow">CARTE</dt>
          <dd className="mt-2 break-all text-sm">
            {data.mapName ?? "Non renseignée"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">DURÉE ENREGISTRÉE</dt>
          <dd className="mt-2 text-sm">
            {data.durationIsEstimate ? "≈ " : ""}
            {formatDuration(data.durationSeconds)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="eyebrow">DATE ENREGISTRÉE</dt>
          <dd className="mt-2 text-sm">{data.matchDate ?? "Non renseignée"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="eyebrow">ENREGISTRÉ PAR</dt>
          <dd className="mt-2 text-sm">{data.recordedBy ?? "Non renseigné"}</dd>
        </div>
      </dl>
      <p className="px-5 pb-5 text-xs leading-relaxed text-slate-500">
        Le format observé correspond aux joueurs enregistrés dans chaque équipe
        ; les départs ou remplacements peuvent modifier cet effectif. Le libellé
        « En ligne » ne confirme pas un match classé. Les données absentes
        restent inconnues.
        {data.durationIsEstimate &&
          " La durée est estimée à partir du nombre de frames et de la fréquence d'enregistrement."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Statistiques des joueurs enregistrées dans le replay
          </caption>
          <thead className="border-t border-white/10 bg-slate-950/40 text-xs text-slate-500">
            <tr>
              {[
                "Joueur",
                "Équipe",
                "Score",
                "Buts",
                "Passes",
                "Arrêts",
                "Tirs",
              ].map((label) => (
                <th key={label} scope="col" className="p-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.players.map((player, index) => (
              <tr key={index} className="border-t border-white/5">
                <th scope="row" className="max-w-48 break-all p-4 font-medium">
                  {player.name}
                  {player.isBot && (
                    <span className="ml-2 text-xs text-slate-500">BOT</span>
                  )}
                </th>
                <td
                  className={`p-4 ${player.team === 0 ? "text-sky-300" : player.team === 1 ? "text-orange-300" : "text-slate-400"}`}
                >
                  {player.team === 0
                    ? "Bleue"
                    : player.team === 1
                      ? "Orange"
                      : "Inconnue"}
                </td>
                {[
                  player.score,
                  player.goals,
                  player.assists,
                  player.saves,
                  player.shots,
                ].map((value, stat) => (
                  <td key={stat} className="p-4 text-slate-300">
                    {value ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.players.length === 0 && (
        <p className="p-5 text-sm text-slate-400">
          Aucune statistique joueur dans cet en-tête.
        </p>
      )}
    </section>
  );
}
