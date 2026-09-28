import type { CoachingReportData } from "../types";
import { replayTime } from "./GameplayPanel";
import MarkdownText from "./MarkdownText";

const confidenceLabels = { low: "faible", medium: "modérée", high: "élevée" };

export default function CoachingReport({
  report,
}: {
  report: CoachingReportData;
}) {
  const color =
    report.score !== null && report.score >= 80
      ? "text-emerald-400"
      : report.score !== null && report.score >= 60
        ? "text-amber-400"
        : "text-rose-400";
  return (
    <article className="panel coaching-report space-y-6 p-6 md:p-8">
      <section aria-labelledby="score-title">
        <h3 id="score-title" className="eyebrow">
          Score de jeu
        </h3>
        {report.score === null ? (
          <>
            <p className="mt-4 text-3xl font-medium text-slate-200">
              Non évaluable avec ces données
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              {report.scoreRationale}
            </p>
          </>
        ) : (
          <p className={`mt-4 text-8xl font-medium tracking-tighter ${color}`}>
            {report.score}
            <span className="ml-2 text-3xl text-slate-500">/100</span>
          </p>
        )}
        {report.score !== null && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            {report.scoreRationale}
          </p>
        )}
        {!report.isMock && (
          <p className="mt-2 text-sm text-slate-400">
            Appréciation du coach, non calibrée sur un rang · confiance{" "}
            {confidenceLabels[report.confidence]}.
          </p>
        )}
        {report.dimensions.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {report.dimensions.map((dimension, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-4">
                <h4 className="font-semibold">
                  {dimension.name} ·{" "}
                  {dimension.score === null
                    ? "Non noté"
                    : `${dimension.score}/100`}
                </h4>
                <p className="mt-2 text-sm text-slate-400 line-clamp-2">
                  {dimension.rationale}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="game-type-title">
        <h3 id="game-type-title" className="eyebrow">
          Game Type
        </h3>
        <p className="mt-2 text-xl font-semibold">{report.gameType}</p>
      </section>
      <section
        aria-labelledby="mistakes-title"
        className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-5"
      >
        <h3 id="mistakes-title" className="text-lg font-semibold text-rose-300">
          Échecs (Mistakes)
        </h3>
        {report.findings.length ? (
          <div className="mt-3 space-y-3">
            {report.findings.map((finding) => (
              <section className="coaching-finding" key={finding.evidenceId}>
                <p className="eyebrow text-rose-300">
                  {replayTime(finding.time)}
                  {finding.endTime > finding.time
                    ? `–${replayTime(finding.endTime)}`
                    : ""}{" "}
                  · {finding.evidenceId} · confiance{" "}
                  {confidenceLabels[finding.confidence]}
                </p>
                <h4 className="mt-2 font-semibold text-rose-200">
                  {finding.observation}
                </h4>
                <p className="mt-2 text-sm text-slate-300">
                  <strong>Pourquoi :</strong> {finding.impact}
                </p>
                <p className="mt-2 text-sm text-emerald-200">
                  <strong>À faire :</strong> {finding.correction}
                </p>
                <details className="mt-3 text-sm text-slate-400">
                  <summary>
                    Observation locale{" "}
                    {finding.heuristic
                      ? "· signal heuristique"
                      : "· événement du replay"}
                  </summary>
                  <p className="mt-2">{finding.facts}</p>
                  <p className="mt-2">
                    <strong>Exercice :</strong> {finding.drill}
                  </p>
                </details>
              </section>
            ))}
          </div>
        ) : report.mistakes.length ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-rose-300">
            {report.mistakes.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-slate-400">
            Le coach n’a retenu aucune erreur suffisamment étayée par les
            séquences disponibles. Cela ne signifie pas un match sans erreur.
          </p>
        )}
      </section>
      <section aria-labelledby="summary-title">
        <h3 id="summary-title" className="text-lg font-semibold">
          Résumé IA — Comment faire mieux
        </h3>
        <p className="mt-3 max-w-3xl whitespace-pre-line leading-relaxed text-slate-300">
          {report.summary}
        </p>
        {report.trainingPlan.length > 0 && (
          <div className="mt-5 rounded-xl border border-emerald-300/10 p-5">
            <h4 className="font-semibold text-emerald-300">
              Plan d’entraînement · prochaines parties
            </h4>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-slate-300">
              {report.trainingPlan.map((step, i) => (
                <li key={i}>
                  <MarkdownText source={step} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
      <section
        aria-label="Points forts et points faibles"
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-5">
          <h3 className="font-semibold text-emerald-400">Points Forts</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
            {report.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-300/10 bg-amber-300/[0.025] p-5">
          <h3 className="font-semibold text-amber-400">Points Faibles</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
            {report.weaknesses.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
      <section
        aria-labelledby="metrics-title"
        className="border-t border-white/10 pt-6"
      >
        <h3 id="metrics-title" className="text-lg font-semibold">
          KPIs & métriques
        </h3>
        {report.dataQuality && (
          <>
            <p className="mt-3 text-sm text-slate-400">
              {report.dataQuality.decodedFrames.toLocaleString("fr-FR")} frames
              décodées · {report.dataQuality.targetObservedSeconds} s du joueur
              observées · couverture {report.dataQuality.coveragePercent} % ·
              contexte spatial complet{" "}
              {report.dataQuality.completeSpatialPercent} %. Métriques calculées
              localement, jamais produites par l’IA.
            </p>
            <details className="mt-3 text-sm text-slate-400">
              <summary>Couverture et limites</summary>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {report.dataQuality.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </details>
          </>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {report.advancedMetrics.map((metric, index) => (
            <div
              key={index}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-5"
            >
              <dt className="text-sm text-slate-400">{metric.label}</dt>
              <dd className="mt-2 text-xl font-semibold">{metric.value}</dd>
              <details className="mt-3 text-xs text-slate-400">
                <summary>Source et méthode</summary>
                <p className="mt-2 leading-relaxed">{metric.source}</p>
              </details>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
