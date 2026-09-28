import { UserRound } from "lucide-react";
import type { ReplayMetadata } from "../types";
import { uniquePlayerIndex } from "../player";

export default function PlayerFocus({
  data,
  playerName,
  index,
  busy,
  onSelect,
  onSettings,
}: {
  data: ReplayMetadata;
  playerName: string;
  index: number | null;
  busy: boolean;
  onSelect: (index: number | null) => void;
  onSettings: () => void;
}) {
  const selected = index === null ? null : data.players[index];
  const configured = uniquePlayerIndex(data.players, playerName);
  const recorded = uniquePlayerIndex(data.players, data.recordedBy ?? "");
  return (
    <section className="player-focus" aria-labelledby="player-focus-title">
      <div className="player-focus-heading">
        <span className="setting-icon">
          <UserRound size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow accent">TON POINT DE VUE</p>
          <h2 id="player-focus-title">
            {selected
              ? `Le match de ${selected.name}`
              : "Qui es-tu dans cette partie ?"}
          </h2>
          <p>
            {selected
              ? "L’analyse ciblera uniquement le joueur sélectionné ci-dessous."
              : playerName.trim()
                ? "Ton pseudo n’a pas de correspondance unique. Confirme ton joueur pour continuer."
                : "Choisis ton joueur ou configure ton pseudo pour le retrouver automatiquement."}
          </p>
        </div>
      </div>
      <div className="player-select-row">
        <div>
          <label htmlFor="match-player" className="field-label">
            Mon joueur dans ce replay
          </label>
          <select
            id="match-player"
            className="input"
            value={index ?? ""}
            disabled={busy}
            onChange={(event) =>
              onSelect(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          >
            <option value="">Sélectionner mon joueur…</option>
            {data.players.map((player, playerIndex) => (
              <option
                key={playerIndex}
                value={playerIndex}
                disabled={player.isBot}
              >
                {player.name} ·{" "}
                {player.team === 0
                  ? "Bleue"
                  : player.team === 1
                    ? "Orange"
                    : "Équipe inconnue"}{" "}
                · #{playerIndex + 1}
                {player.isBot ? " (BOT)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="button-quiet" onClick={onSettings}>
          Configurer mon profil
        </button>
      </div>
      {index !== null && index === configured && (
        <p className="player-detection">
          <span className="status-dot" /> Correspondance unique avec ton pseudo
          configuré.
        </p>
      )}
      {recorded !== null && recorded !== index && (
        <div className="recorder-suggestion">
          <p>
            Le fichier a été enregistré par{" "}
            <strong>{data.players[recorded].name}</strong>. Est-ce toi ?
          </p>
          <button
            className="button-secondary"
            disabled={busy}
            onClick={() => onSelect(recorded)}
          >
            Oui, c’est mon joueur
          </button>
        </div>
      )}
      {selected && (
        <dl className="personal-stats">
          {[
            ["Score", selected.score],
            ["Buts", selected.goals],
            ["Passes", selected.assists],
            ["Arrêts", selected.saves],
            ["Tirs", selected.shots],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="player-focus-note">
        Compteurs réels de l’en-tête. Le coaching ajoute les frames réseau, les
        métriques locales et le contexte des autres joueurs.
      </p>
    </section>
  );
}
