use boxcars::{HeaderProp, ParserBuilder};
use serde::Serialize;
use std::{fs, io::Read, path::Path};

pub const MAX_REPLAY_BYTES: u64 = 128 * 1024 * 1024;
type Properties = [(String, HeaderProp)];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayMetadata {
    pub replay_name: Option<String>,
    pub match_date: Option<String>,
    pub map_name: Option<String>,
    pub match_type: Option<String>,
    pub game_type: String,
    pub team_size: Option<u32>,
    pub recorded_team_size: Option<u32>,
    pub blue_score: Option<u32>,
    pub orange_score: Option<u32>,
    pub duration_seconds: Option<f64>,
    pub duration_is_estimate: bool,
    pub recorded_by: Option<String>,
    pub players: Vec<ReplayPlayer>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayPlayer {
    pub name: String,
    pub team: Option<u8>,
    pub is_bot: bool,
    pub score: Option<u32>,
    pub goals: Option<u32>,
    pub assists: Option<u32>,
    pub saves: Option<u32>,
    pub shots: Option<u32>,
}

fn property<'a>(properties: &'a Properties, name: &str) -> Option<&'a HeaderProp> {
    properties
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value)
}

fn text(properties: &Properties, name: &str) -> Option<String> {
    property(properties, name)
        .and_then(HeaderProp::as_string)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn integer(properties: &Properties, name: &str) -> Option<u32> {
    property(properties, name)
        .and_then(HeaderProp::as_i32)
        .and_then(|value| u32::try_from(value).ok())
}

fn number(properties: &Properties, name: &str) -> Option<f64> {
    let value = match property(properties, name)? {
        HeaderProp::Float(value) => f64::from(*value),
        HeaderProp::Int(value) => f64::from(*value),
        _ => return None,
    };
    (value.is_finite() && value >= 0.0).then_some(value)
}

pub fn parse_file(path: &Path) -> Result<ReplayMetadata, String> {
    parse_bytes(&read_file(path)?)
}

pub(crate) fn read_file(path: &Path) -> Result<Vec<u8>, String> {
    let metadata =
        fs::symlink_metadata(path).map_err(|error| format!("Replay inaccessible : {error}"))?;
    if !metadata.file_type().is_file() || metadata.len() == 0 {
        return Err("Le replay doit être un fichier régulier non vide.".into());
    }
    if metadata.len() > MAX_REPLAY_BYTES {
        return Err("Replay trop volumineux (limite : 128 Mio).".into());
    }
    // Borne aussi la lecture si le fichier grandit pendant le scan.
    let mut data = Vec::new();
    fs::File::open(path)
        .map_err(|error| format!("Lecture impossible : {error}"))?
        .take(MAX_REPLAY_BYTES + 1)
        .read_to_end(&mut data)
        .map_err(|error| format!("Lecture impossible : {error}"))?;
    if data.len() as u64 > MAX_REPLAY_BYTES {
        return Err("Replay trop volumineux (limite : 128 Mio).".into());
    }
    Ok(data)
}

pub fn parse_bytes(data: &[u8]) -> Result<ReplayMetadata, String> {
    // Vérifie l'intégrité du conteneur, sans décoder les frames réseau.
    let replay = ParserBuilder::new(data)
        .always_check_crc()
        .never_parse_network_data()
        .parse()
        .map_err(|_| {
            "Replay illisible, incomplet ou incompatible avec cette version du parseur.".to_string()
        })?;
    Ok(extract_metadata(&replay.properties))
}

pub(crate) fn extract_metadata(properties: &Properties) -> ReplayMetadata {
    let players = property(properties, "PlayerStats")
        .and_then(HeaderProp::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|fields| {
                    let name = text(fields, "Name")?;
                    Some(ReplayPlayer {
                        name,
                        team: integer(fields, "Team")
                            .filter(|team| *team <= 1)
                            .map(|team| team as u8),
                        is_bot: property(fields, "bBot")
                            .and_then(HeaderProp::as_bool)
                            .unwrap_or(false),
                        score: integer(fields, "Score"),
                        goals: integer(fields, "Goals"),
                        assists: integer(fields, "Assists"),
                        saves: integer(fields, "Saves"),
                        shots: integer(fields, "Shots"),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let team_size = integer(properties, "TeamSize").filter(|size| (1..=4).contains(size));
    let match_type = text(properties, "MatchType");
    // Online ne prouve pas Ranked. Le classement ne doit pas être inventé.
    let mode = match match_type.as_deref() {
        Some("Online") => "En ligne",
        Some("Private") => "Privé",
        Some("Offline") | Some("Local") => "Local",
        Some("Lan") | Some("LAN") => "LAN",
        Some(value) => value,
        None => "Type inconnu",
    };
    let blue_players = players
        .iter()
        .filter(|player| player.team == Some(0))
        .count();
    let orange_players = players
        .iter()
        .filter(|player| player.team == Some(1))
        .count();
    let recorded_team_size = (blue_players == orange_players && (1..=4).contains(&blue_players))
        .then_some(blue_players as u32);
    // TeamSize peut être la capacité du lobby (RLCS : 4, alors que 3 jouent).
    let game_type = recorded_team_size
        .map(|size| format!("{size}v{size} observé · {mode}"))
        .unwrap_or_else(|| mode.to_owned());
    let exact_duration = number(properties, "TotalSecondsPlayed");
    let estimated_duration = integer(properties, "NumFrames")
        .zip(number(properties, "RecordFPS"))
        .filter(|(_, fps)| *fps > 0.0)
        .map(|(frames, fps)| f64::from(frames) / fps);
    ReplayMetadata {
        replay_name: text(properties, "ReplayName"),
        match_date: text(properties, "Date"),
        map_name: text(properties, "MapName"),
        match_type,
        game_type,
        team_size,
        recorded_team_size,
        blue_score: integer(properties, "Team0Score"),
        orange_score: integer(properties, "Team1Score"),
        duration_seconds: exact_duration.or(estimated_duration),
        duration_is_estimate: exact_duration.is_none() && estimated_duration.is_some(),
        recorded_by: text(properties, "PlayerName"),
        players,
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub(crate) fn minimal_replay() -> Vec<u8> {
        let mut header = Vec::new();
        for version in [868_i32, 20, 10] {
            header.extend_from_slice(&version.to_le_bytes());
        }
        for value in ["TAGame.Replay_Soccar_TA", "None"] {
            header.extend_from_slice(&((value.len() + 1) as i32).to_le_bytes());
            header.extend_from_slice(value.as_bytes());
            header.push(0);
        }
        let body = [0_u8; 40];
        let mut data = Vec::new();
        for section in [&header[..], &body[..]] {
            data.extend_from_slice(&(section.len() as i32).to_le_bytes());
            data.extend_from_slice(&boxcars::crc::calc_crc(section).to_le_bytes());
            data.extend_from_slice(section);
        }
        data
    }

    #[test]
    fn verifies_crc_and_rejects_truncated_container() {
        let mut data = minimal_replay();
        assert!(parse_bytes(&data).is_ok());
        let last = data.len() - 1;
        data[last] = 1;
        assert!(parse_bytes(&data).is_err());
        data.truncate(20);
        assert!(parse_bytes(&data).is_err());
    }

    #[test]
    fn rejects_oversized_file_before_reading() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("large.replay");
        fs::File::create(&path)
            .unwrap()
            .set_len(MAX_REPLAY_BYTES + 1)
            .unwrap();
        assert!(parse_file(&path).unwrap_err().contains("128 Mio"));
    }

    #[test]
    fn missing_fields_stay_unknown_and_online_is_not_ranked() {
        let properties = vec![
            ("MatchType".into(), HeaderProp::Name("Online".into())),
            ("TeamSize".into(), HeaderProp::Int(2)),
        ];
        let data = extract_metadata(&properties);
        assert_eq!(data.game_type, "En ligne");
        assert_eq!(data.team_size, Some(2));
        assert!(data.recorded_team_size.is_none());
        assert!(data.blue_score.is_none());
        assert!(data.duration_seconds.is_none());
        assert!(data.players.is_empty());
    }

    #[test]
    fn extracts_stats_and_marks_duration_estimate() {
        let properties = vec![
            ("NumFrames".into(), HeaderProp::Int(9000)),
            ("RecordFPS".into(), HeaderProp::Float(30.0)),
            (
                "PlayerStats".into(),
                HeaderProp::Array(vec![vec![
                    ("Name".into(), HeaderProp::Str("Test player".into())),
                    ("Team".into(), HeaderProp::Int(0)),
                    ("Goals".into(), HeaderProp::Int(2)),
                    ("Score".into(), HeaderProp::Int(-1)),
                ]]),
            ),
        ];
        let data = extract_metadata(&properties);
        assert_eq!(data.duration_seconds, Some(300.0));
        assert!(data.duration_is_estimate);
        assert_eq!(data.players[0].goals, Some(2));
        assert!(data.players[0].score.is_none());
    }

    #[test]
    fn rejects_invalid_bytes_and_non_finite_stats() {
        assert!(parse_bytes(b"not a replay").is_err());
        let properties = vec![
            ("TotalSecondsPlayed".into(), HeaderProp::Float(f32::NAN)),
            ("RecordFPS".into(), HeaderProp::Float(0.0)),
        ];
        let data = extract_metadata(&properties);
        assert!(data.duration_seconds.is_none());
    }
}
