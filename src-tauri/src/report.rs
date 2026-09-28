use crate::{
    gameplay::{GameplayDossier, Quality},
    metadata::ReplayPlayer,
    player::PlayerTarget,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    Low,
    Medium,
    High,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AiFinding {
    evidence_id: String,
    observation: String,
    impact: String,
    correction: String,
    drill: String,
    confidence: Confidence,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Dimension {
    name: String,
    score: Option<u8>,
    rationale: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AiFeedback {
    score: Option<u8>,
    score_rationale: String,
    confidence: Confidence,
    summary: String,
    mistakes: Vec<AiFinding>,
    strengths: Vec<String>,
    weaknesses: Vec<String>,
    dimensions: Vec<Dimension>,
    training_plan: Vec<String>,
}
fn invalid_text(text: &str, max: usize) -> bool {
    text.trim().is_empty() || text.len() > max
}
impl AiFeedback {
    pub fn validate(&self) -> Result<(), String> {
        if self.score.is_some_and(|s| s > 100)
            || invalid_text(&self.summary, 12_000)
            || invalid_text(&self.score_rationale, 3000)
            || self.mistakes.len() > 8
            || self.dimensions.len() > 5
            || [&self.strengths, &self.weaknesses, &self.training_plan]
                .iter()
                .any(|list| list.len() > 8 || list.iter().any(|text| invalid_text(text, 3000)))
            || self.mistakes.iter().any(|f| {
                invalid_text(&f.evidence_id, 64)
                    || [&f.observation, &f.impact, &f.correction, &f.drill]
                        .iter()
                        .any(|s| invalid_text(s, 3000))
            })
            || self.dimensions.iter().any(|d| {
                invalid_text(&d.name, 100)
                    || invalid_text(&d.rationale, 3000)
                    || d.score.is_some_and(|s| s > 100)
            })
        {
            return Err("Rapport IA invalide, vide ou trop volumineux.".into());
        }
        Ok(())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    evidence_id: String,
    time: f64,
    end_time: f64,
    facts: String,
    heuristic: bool,
    observation: String,
    impact: String,
    correction: String,
    drill: String,
    confidence: Confidence,
}
#[derive(Serialize)]
pub struct Metric {
    label: String,
    value: String,
    source: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoachingReport {
    score: Option<u8>,
    score_rationale: String,
    confidence: Confidence,
    game_type: String,
    mistakes: Vec<String>,
    findings: Vec<Finding>,
    summary: String,
    strengths: Vec<String>,
    weaknesses: Vec<String>,
    dimensions: Vec<Dimension>,
    training_plan: Vec<String>,
    advanced_metrics: Vec<Metric>,
    data_quality: Option<Quality>,
    is_mock: bool,
    player: PlayerTarget,
    provider: String,
    model: String,
    analysis_scope: String,
}
impl CoachingReport {
    pub fn demo(game_type: String, player: PlayerTarget) -> Self {
        Self { score:Some(82),score_rationale:"Exemple fictif, pas une évaluation de cette partie.".into(),confidence:Confidence::Low,
            game_type,mistakes:vec!["Double commit en défense à 02:14 (exemple fictif).".into(),"Dernier défenseur : challenge trop tôt à 03:42 (exemple fictif).".into()],findings:vec![],
            summary:"Priorise une rotation au second poteau et conserve une distance de sécurité lorsque ton partenaire challenge. Utilise davantage les petits pads pour rester dans l'action. Exemple fictif.".into(),
            strengths:vec!["Bonne précision des tirs (exemple fictif).".into()],weaknesses:vec!["Gestion du boost en transition (exemple fictif).".into()],dimensions:vec![],training_plan:vec![],
            advanced_metrics:[("Boost moyen","38 / 100"),("Vitesse moyenne","1 420 uu/s")].into_iter().map(|(label,value)|Metric {label:label.into(),value:value.into(),source:"Démonstration fictive".into()}).collect(),
            data_quality:None,is_mock:true,player,provider:"demo".into(),model:"".into(),analysis_scope:"demo".into() }
    }
    pub fn from_ai(
        game_type: String,
        stats: &ReplayPlayer,
        player: PlayerTarget,
        provider: String,
        model: String,
        feedback: AiFeedback,
        dossier: GameplayDossier,
    ) -> Result<Self, String> {
        feedback.validate()?;
        let mut findings = vec![];
        let mut used = std::collections::HashSet::new();
        for finding in feedback.mistakes {
            let evidence=dossier.evidence(&finding.evidence_id).ok_or_else(||"Le coach cite une séquence inexistante. Rapport rejeté, aucun timestamp inventé n'est accepté.".to_string())?;
            if !used.insert(finding.evidence_id.clone()) {
                return Err("Le coach a dupliqué une séquence dans les erreurs.".into());
            }
            findings.push(Finding {
                evidence_id: finding.evidence_id,
                time: evidence.time,
                end_time: evidence.end_time,
                facts: evidence.facts.clone(),
                heuristic: evidence.heuristic,
                observation: finding.observation,
                impact: finding.impact,
                correction: finding.correction,
                drill: finding.drill,
                confidence: finding.confidence,
            });
        }
        let mut metrics: Vec<_> = [
            ("Score du joueur", stats.score),
            ("Buts", stats.goals),
            ("Passes", stats.assists),
            ("Arrêts", stats.saves),
            ("Tirs", stats.shots),
        ]
        .into_iter()
        .map(|(label, value)| Metric {
            label: label.into(),
            value: value.map(|v| v.to_string()).unwrap_or_else(|| "—".into()),
            source: "En-tête du replay".into(),
        })
        .collect();
        metrics.extend(dossier.metrics.iter().map(|m| {
            Metric {
                label: m.label.clone(),
                value: m
                    .value
                    .map(|v| format!("{v:.1} {}", m.unit))
                    .unwrap_or_else(|| "—".into()),
                source: format!("{} · {:.1} s observées", m.method, m.measured_seconds),
            }
        }));
        let score = if dossier.quality.can_assess {
            feedback.score
        } else {
            None
        };
        let score_rationale = if dossier.quality.can_assess {
            feedback.score_rationale
        } else {
            "Couverture insuffisante ou arène non validée pour une note globale. Les observations disponibles restent utilisables pour le coaching.".into()
        };
        let dimensions = feedback
            .dimensions
            .into_iter()
            .map(|mut d| {
                if !dossier.quality.can_assess {
                    d.score = None;
                }
                d
            })
            .collect();
        Ok(Self {
            score,
            score_rationale,
            confidence: feedback.confidence,
            game_type,
            mistakes: vec![],
            findings,
            summary: feedback.summary,
            strengths: feedback.strengths,
            weaknesses: feedback.weaknesses,
            dimensions,
            training_plan: feedback.training_plan,
            advanced_metrics: metrics,
            data_quality: Some(dossier.quality),
            is_mock: false,
            player,
            provider,
            model,
            analysis_scope: "network-gameplay".into(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn feedback() -> AiFeedback {
        serde_json::from_value(serde_json::json!({"score":82,"score_rationale":"Appréciation du coach, non calibrée sur un rang.","confidence":"medium","summary":"Résumé contextualisé.","mistakes":[],"strengths":[],"weaknesses":[],"dimensions":[],"training_plan":[]})).unwrap()
    }
    #[test]
    fn validates_coach_contract_and_score_bounds() {
        let mut result = feedback();
        assert!(result.validate().is_ok());
        result.score = Some(101);
        assert!(result.validate().is_err());
        result.score = Some(82);
        result.summary = "".into();
        assert!(result.validate().is_err());
        assert!(serde_json::from_str::<AiFeedback>(
            r#"{"summary":"old counters only","mistakes":[],"strengths":[],"weaknesses":[]}"#
        )
        .is_err());
    }
    fn dossier(can_assess: bool) -> GameplayDossier {
        GameplayDossier {
            version: 1,
            target: 0,
            quality: Quality {
                decoded_frames: 10000,
                recording_seconds: 300.0,
                active_seconds: 250.0,
                target_observed_seconds: 245.0,
                spatial_observed_seconds: 230.0,
                coverage_percent: 98.0,
                complete_spatial_percent: 92.0,
                timeline_interval_seconds: 1.0,
                timeline_samples: 300,
                standard_soccar: true,
                can_assess,
                warnings: vec![],
            },
            metrics: vec![],
            timeline: vec![],
            key_sequences: vec![],
            evidence: vec![crate::gameplay::Evidence {
                id: "E1".into(),
                time: 12.3,
                end_time: 14.0,
                kind: "tight_teammate_spacing".into(),
                facts: "Distance observée < 500 uu.".into(),
                heuristic: true,
                context: crate::gameplay::Snapshot {
                    time: 12.3,
                    clock: Some(288),
                    phase: "Active".into(),
                    ball: None,
                    ball_velocity: None,
                    cars: vec![],
                },
            }],
        }
    }
    fn make_report(result: AiFeedback, dossier: GameplayDossier) -> Result<CoachingReport, String> {
        let stats = ReplayPlayer {
            name: "You".into(),
            team: Some(1),
            is_bot: false,
            score: Some(410),
            goals: Some(2),
            assists: None,
            saves: None,
            shots: Some(5),
        };
        CoachingReport::from_ai(
            "3v3 observé".into(),
            &stats,
            PlayerTarget {
                index: 0,
                name: "You".into(),
                team: Some(1),
            },
            "gemini".into(),
            "example-model".into(),
            result,
            dossier,
        )
    }
    fn finding(id: &str) -> AiFinding {
        AiFinding {
            evidence_id: id.into(),
            observation: "Proximité à contextualiser.".into(),
            impact: "Couverture possiblement limitée.".into(),
            correction: "Garder une option de soutien.".into(),
            drill: "Revoir trois situations similaires.".into(),
            confidence: Confidence::Medium,
        }
    }
    #[test]
    fn rejects_unknown_or_duplicated_evidence_and_binds_local_timestamps() {
        let mut result = feedback();
        result.mistakes = vec![finding("E999")];
        assert!(make_report(result, dossier(true)).is_err());
        let mut result = feedback();
        result.mistakes = vec![finding("E1"), finding("E1")];
        assert!(make_report(result, dossier(true)).is_err());
        let mut result = feedback();
        result.mistakes = vec![finding("E1")];
        let report = make_report(result, dossier(true)).unwrap();
        assert_eq!(report.findings[0].time, 12.3);
        assert_eq!(report.findings[0].facts, "Distance observée < 500 uu.");
        assert!(report.findings[0].heuristic);
        assert_eq!(report.advanced_metrics[0].value, "410");
        assert_eq!(report.advanced_metrics[2].value, "—");
        assert_eq!(report.player.name, "You");
        assert_eq!(report.score, Some(82));
    }
    #[test]
    fn insufficient_coverage_removes_global_and_dimension_scores() {
        let mut result = feedback();
        result.dimensions = vec![Dimension {
            name: "Boost".into(),
            score: Some(90),
            rationale: "Appréciation subjective.".into(),
        }];
        let report = make_report(result, dossier(false)).unwrap();
        assert!(report.score.is_none());
        assert!(report.dimensions[0].score.is_none());
    }
}
