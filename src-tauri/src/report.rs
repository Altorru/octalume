use serde::Serialize;

#[derive(Serialize)]
pub struct Metric {
    label: String,
    value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoachingReport {
    score: u8,
    game_type: String,
    mistakes: Vec<String>,
    summary: String,
    strengths: Vec<String>,
    weaknesses: Vec<String>,
    advanced_metrics: Vec<Metric>,
    is_mock: bool,
}

impl CoachingReport {
    pub fn demo() -> Self {
        Self {
            score: 82,
            game_type: "2v2 Ranked".into(),
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
        }
    }
}
