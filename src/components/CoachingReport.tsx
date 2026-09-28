import type { CoachingReportData } from "../types";

export default function CoachingReport({
  report,
}: {
  report: CoachingReportData;
}) {
  const color =
    report.score >= 80
      ? "text-emerald-400"
      : report.score >= 60
        ? "text-amber-400"
        : "text-rose-400";
  return (
    <article className="panel space-y-8 p-6 md:p-8">
      <section aria-labelledby="score-title">
        <h3 id="score-title" className="eyebrow">
          Score de jeu
        </h3>
        <p className={`mt-3 text-7xl font-bold tracking-tight ${color}`}>
          {report.score}
          <span className="ml-2 text-3xl text-slate-500">/100</span>
        </p>
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
        {report.mistakes.length ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-rose-300">
            {report.mistakes.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-slate-400">
            Aucune erreur critique signalée.
          </p>
        )}
      </section>
      <section aria-labelledby="summary-title">
        <h3 id="summary-title" className="text-lg font-semibold">
          Résumé IA — Comment faire mieux
        </h3>
        <p className="mt-3 leading-relaxed text-slate-300">{report.summary}</p>
      </section>
      <section
        aria-label="Points forts et points faibles"
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="rounded-xl bg-slate-950/50 p-5">
          <h3 className="font-semibold text-emerald-400">Points Forts</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
            {report.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-slate-950/50 p-5">
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
          Métriques Avancées
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {report.advancedMetrics.map((metric, index) => (
            <div key={index} className="rounded-xl bg-slate-950/50 p-4">
              <dt className="text-sm text-slate-400">{metric.label}</dt>
              <dd className="mt-2 text-xl font-semibold">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
