use crate::metadata::ReplayPlayer;
use crate::player::PlayerTarget;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AiFeedback {
    summary: String,
    mistakes: Vec<String>,
    strengths: Vec<String>,
    weaknesses: Vec<String>,
}
impl AiFeedback {
    pub fn validate(&self) -> Result<(), String> {
        if !self.mistakes.is_empty() {
            return Err("L'IA signale des erreurs de gameplay non démontrables avec les statistiques seules. Rapport rejeté.".into());
        }
        if self.summary.trim().is_empty()
            || self.summary.len() > 10_000
            || [&self.mistakes, &self.strengths, &self.weaknesses]
                .iter()
                .any(|list| {
                    list.len() > 10
                        || list
                            .iter()
                            .any(|text| text.trim().is_empty() || text.len() > 2000)
                })
        {
            return Err("Le rapport IA est vide ou dépasse les limites autorisées.".into());
        }
        Ok(())
    }
}

#[derive(Serialize)]
pub struct Metric {
    label: String,
    value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoachingReport {
    score: Option<u8>,
    game_type: String,
    mistakes: Vec<String>,
    summary: String,
    strengths: Vec<String>,
    weaknesses: Vec<String>,
    advanced_metrics: Vec<Metric>,
    is_mock: bool,
    player: PlayerTarget,
    provider: String,
    model: String,
    analysis_scope: String,
}

impl CoachingReport {
    pub fn demo(game_type: String, player: PlayerTarget) -> Self {
        Self {
            score: Some(82),
            game_type,
            mistakes: vec![
                "Double commit en défense à 02:14.".into(),
                "Dernier défenseur : challenge trop tôt à 03:42.".into(),
            ],
            summary: "Priorise une rotation au second poteau et conserve une distance de sécurité lorsque ton partenaire challenge. Utilise davantage les petits pads pour rester dans l'action.".into(),
            strengths: vec!["Bonne précision des tirs.".into(), "Pression offensive régulière.".into()],
            weaknesses: vec!["Gestion du boost en transition.".into(), "Prise de décision en dernier défenseur.".into()],
            advanced_metrics: [
                ("Précision des tirs", "67 %"),
                ("Boost moyen", "38 / 100"),
                ("Temps sans boost", "24 s"),
                ("Vitesse moyenne", "1 420 uu/s"),
            ].into_iter().map(|(label, value)| Metric { label: label.into(), value: value.into() }).collect(),
            is_mock: true,
            player,
            provider: "demo".into(),
            model: "".into(),
            analysis_scope: "demo".into(),
        }
    }

    pub fn from_ai(
        game_type: String,
        stats: &ReplayPlayer,
        player: PlayerTarget,
        provider: String,
        model: String,
        feedback: AiFeedback,
    ) -> Self {
        Self {
            score: None,
            game_type,
            mistakes: feedback.mistakes,
            summary: feedback.summary,
            strengths: feedback.strengths,
            weaknesses: feedback.weaknesses,
            advanced_metrics: [
                ("Score du joueur", stats.score),
                ("Buts", stats.goals),
                ("Passes", stats.assists),
                ("Arrêts", stats.saves),
                ("Tirs", stats.shots),
            ]
            .into_iter()
            .map(|(label, value)| Metric {
                label: label.into(),
                value: value
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "—".into()),
            })
            .collect(),
            is_mock: false,
            player,
            provider,
            model,
            analysis_scope: "header-statistics".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn real_report_has_no_gameplay_score_and_keeps_server_bound_identity_and_metrics() {
        let stats = ReplayPlayer {
            name: "You".into(),
            team: Some(0),
            is_bot: false,
            score: Some(410),
            goals: Some(2),
            assists: None,
            saves: None,
            shots: Some(5),
        };
        let target = PlayerTarget {
            index: 0,
            name: "You".into(),
            team: Some(0),
        };
        let feedback = AiFeedback {
            summary: "Retour limité aux statistiques.".into(),
            mistakes: vec![],
            strengths: vec![],
            weaknesses: vec![],
        };
        let report = CoachingReport::from_ai(
            "3v3 observé".into(),
            &stats,
            target,
            "openai".into(),
            "example-model".into(),
            feedback,
        );
        assert!(report.score.is_none());
        assert!(!report.is_mock);
        assert_eq!(report.player.name, "You");
        assert_eq!(report.advanced_metrics[0].value, "410");
        assert_eq!(report.advanced_metrics[2].value, "—");
        assert_eq!(report.analysis_scope, "header-statistics");
    }
    #[test]
    fn rejects_empty_oversized_and_extra_model_fields() {
        assert!(serde_json::from_str::<AiFeedback>(
            r#"{"summary":"s","mistakes":[],"strengths":[],"weaknesses":[],"score":100}"#
        )
        .is_err());
        let mut feedback = AiFeedback {
            summary: "".into(),
            mistakes: vec![],
            strengths: vec![],
            weaknesses: vec![],
        };
        assert!(feedback.validate().is_err());
        feedback.summary = "valid".into();
        feedback.mistakes = vec!["x".into(); 11];
        assert!(feedback.validate().is_err());
    }
}
