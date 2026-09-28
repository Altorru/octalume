use crate::metadata::ReplayPlayer;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlayerTarget {
    pub index: usize,
    pub name: String,
    pub team: Option<u8>,
}

pub fn validate_target(players: &[ReplayPlayer], target: &PlayerTarget) -> Result<(), String> {
    let player = players.get(target.index).ok_or_else(|| {
        "Le joueur sélectionné n'existe pas dans ce replay. Rafraîchis la bibliothèque.".to_string()
    })?;
    if player.is_bot {
        return Err("Sélectionne un joueur humain pour le coaching.".into());
    }
    if player.name != target.name || player.team != target.team {
        return Err(
            "Le joueur du replay ne correspond plus à la sélection. Rafraîchis la bibliothèque."
                .into(),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn human(name: &str, team: u8) -> ReplayPlayer {
        ReplayPlayer {
            name: name.into(),
            team: Some(team),
            is_bot: false,
            score: None,
            goals: None,
            assists: None,
            saves: None,
            shots: None,
        }
    }

    #[test]
    fn accepts_exact_player_and_distinguishes_duplicate_names() {
        let players = [human("Same name", 0), human("Same name", 1)];
        let mut target = PlayerTarget {
            index: 1,
            name: "Same name".into(),
            team: Some(1),
        };
        assert!(validate_target(&players, &target).is_ok());
        target.index = 0;
        assert!(validate_target(&players, &target).is_err());
    }

    #[test]
    fn rejects_missing_changed_and_bot_players() {
        let mut players = [human("You", 0)];
        let mut target = PlayerTarget {
            index: 0,
            name: "You".into(),
            team: Some(0),
        };
        assert!(validate_target(&players, &target).is_ok());
        target.index = 10;
        assert!(validate_target(&players, &target).is_err());
        target.index = 0;
        target.name = "Other".into();
        assert!(validate_target(&players, &target).is_err());
        target.name = "You".into();
        players[0].is_bot = true;
        assert!(validate_target(&players, &target).is_err());
    }
}
