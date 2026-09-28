import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChartNoAxesCombined, LoaderCircle } from "lucide-react";
import type { GameplayPreview } from "../types";

export function replayTime(time: number) {
  const seconds = Math.floor(time);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export default function GameplayPanel({
  filePath,
  target,
  busy,
  onPreparing,
}: {
  filePath: string;
  target: { index: number; name: string; team: number | null } | null;
  busy: boolean;
  onPreparing: (value: boolean) => void;
}) {
  const [result, setResult] = useState<{
    scope: string;
    data: GameplayPreview;
  } | null>(null);
  const [error, setError] = useState<{ scope: string; message: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const scope = JSON.stringify([filePath, target]);
  const preview = result?.scope === scope ? result.data : null;
  async function prepare() {
    if (!target || pending.current || busy) return;
    pending.current = true;
    setLoading(true);
    onPreparing(true);
    setError(null);
    try {
      const data = await invoke<GameplayPreview>("get_replay_gameplay", {
        filePath,
        playerTarget: target,
      });
      setResult({ scope, data });
    } catch (cause) {
      setError({
        scope,
        message:
          typeof cause === "string"
            ? cause
            : "Impossible d’extraire le gameplay.",
      });
    } finally {
      pending.current = false;
      setLoading(false);
      onPreparing(false);
    }
  }
  return (
    <section
      className="settings-card gameplay-panel"
      aria-labelledby="gameplay-data-title"
      aria-busy={loading}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow accent">LES FAITS AVANT LES CONSEILS</p>
          <h2 id="gameplay-data-title">Données gameplay · calcul local</h2>
        </div>
        <button
          className="button-quiet"
          disabled={busy || !target || loading}
          onClick={() => void prepare()}
        >
          {loading ? (
            <LoaderCircle
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <ChartNoAxesCombined size={16} aria-hidden="true" />
          )}
          {loading
            ? "Décodage des frames…"
            : preview
              ? "Recalculer les données"
              : "Extraire le gameplay"}
        </button>
      </div>
      <p className="field-help">
        Positions, vitesse, boost et placement relatif calculés sur les frames
        réseau. Aucune clé ni envoi nécessaire. L’analyse IA refera cette
        extraction sur le fichier courant.
      </p>
      {error?.scope === scope && (
        <p role="alert" className="parse-error">
          {error.message}
        </p>
      )}
      {preview && (
        <>
          <p className="field-help" role="status">
            {preview.quality.decodedFrames.toLocaleString("fr-FR")} frames ·{" "}
            {preview.quality.activeSeconds} s actives · couverture joueur{" "}
            {preview.quality.coveragePercent} % · contexte spatial complet{" "}
            {preview.quality.completeSpatialPercent} % · dossier ≈{" "}
            {Math.round(preview.payloadBytes / 1024)} Kio.
          </p>
          <details className="gameplay-details">
            <summary>
              Métriques déterministes ({preview.metrics.length})
            </summary>
            <dl className="gameplay-metrics">
              {preview.metrics.map((m) => (
                <div key={m.key}>
                  <dt>{m.label}</dt>
                  <dd>
                    {m.value === null
                      ? "—"
                      : `${m.value.toLocaleString("fr-FR")} ${m.unit}`}
                  </dd>
                  <p className="field-help">{m.measuredSeconds} s mesurées</p>
                  <details>
                    <summary>Méthode</summary>
                    <p className="field-help">{m.method}</p>
                  </details>
                </div>
              ))}
            </dl>
          </details>
          <details className="gameplay-details">
            <summary>
              Séquences et signaux à examiner ({preview.evidence.length})
            </summary>
            <ul className="gameplay-evidence">
              {preview.evidence.map((e) => (
                <li key={e.id}>
                  <strong>
                    {replayTime(e.time)}
                    {e.endTime > e.time
                      ? `–${replayTime(e.endTime)}`
                      : ""} ·{" "}
                    {e.heuristic
                      ? "Signal à contextualiser"
                      : "Événement du replay"}{" "}
                    · {e.id}
                  </strong>
                  <p>{e.facts}</p>
                </li>
              ))}
            </ul>
          </details>
          <details className="gameplay-details">
            <summary>Couverture et limites des données</summary>
            <ul>
              {preview.quality.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
