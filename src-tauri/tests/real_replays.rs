use octalume_lib::{gameplay, metadata, player, replays};
use std::{fs, path::PathBuf};

fn fixture_folder() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.local-tests/replays")
}

#[test]
#[ignore = "Download public fixtures with npm run fixtures:download first"]
fn parses_public_replays_and_preserves_real_stats() {
    let fixtures = fixture_folder();
    let expectations = [
        ("rlcs.replay", "Stadium_p", "Lan", 2, 5, 4, "Deevo", 3),
        (
            "rumble.replay",
            "stadium_foggy_p",
            "Online",
            5,
            2,
            3,
            "GOOSE LORD",
            2,
        ),
        (
            "epic.replay",
            "EuroStadium_Night_P",
            "Online",
            1,
            2,
            3,
            "Twitch - AvocadoZLive",
            2,
        ),
    ];
    for (name, map, mode, blue, orange, capacity, scorer, goals) in expectations {
        let parsed =
            metadata::parse_file(&fixtures.join(name)).expect("Public replay should parse");
        assert_eq!(parsed.map_name.as_deref(), Some(map));
        assert_eq!(parsed.match_type.as_deref(), Some(mode));
        assert_eq!(parsed.blue_score, Some(blue));
        assert_eq!(parsed.orange_score, Some(orange));
        assert_eq!(parsed.team_size, Some(capacity));
        assert_eq!(parsed.recorded_team_size, Some(3));
        assert_eq!(parsed.players.len(), 6);
        assert_eq!(
            parsed
                .players
                .iter()
                .find(|player| player.name == scorer)
                .unwrap()
                .goals,
            Some(goals)
        );
        assert!(parsed.match_date.is_some());
        assert!(parsed.duration_seconds.unwrap() > 200.0);
        assert!(parsed.duration_is_estimate);
        assert!(!parsed.game_type.contains("Ranked"));
        assert!(parsed.game_type.starts_with("3v3 observé"));
    }
}

#[test]
#[ignore = "Download public fixtures with npm run fixtures:download first"]
fn scan_isolates_bad_files_and_revalidates_changed_files() {
    let dir = tempfile::tempdir().unwrap();
    let good = dir.path().join("valid.replay");
    fs::copy(fixture_folder().join("epic.replay"), &good).unwrap();
    fs::write(dir.path().join("invalid.replay"), b"invalid bytes").unwrap();
    fs::write(dir.path().join("empty.replay"), b"").unwrap();
    let files = replays::scan_directory(dir.path().to_str().unwrap()).unwrap();
    assert_eq!(files.len(), 3);
    assert_eq!(
        files.iter().filter(|file| file.metadata.is_some()).count(),
        1
    );
    assert_eq!(
        files
            .iter()
            .filter(|file| file.parse_error.is_some())
            .count(),
        2
    );
    let index = replays::ReplayIndex::default();
    index.replace(&files).unwrap();
    for file in &files {
        assert_eq!(
            index.ensure_allowed(&file.file_path).is_ok(),
            file.metadata.is_some()
        );
    }
    // Le fichier peut être corrompu après le scan : l'analyse doit reparser.
    fs::write(&good, b"now corrupt").unwrap();
    assert!(metadata::parse_file(&good).is_err());
    let rescanned = replays::scan_directory(dir.path().to_str().unwrap()).unwrap();
    assert!(rescanned.iter().all(|file| file.parse_error.is_some()));
}

#[test]
#[ignore = "Download public fixtures with npm run fixtures:download first"]
fn corrupted_crc_and_truncated_replay_are_rejected() {
    let bytes = fs::read(fixture_folder().join("epic.replay")).unwrap();
    let mut corrupt = bytes.clone();
    let last = corrupt.len() - 1;
    corrupt[last] ^= 0xFF;
    assert!(metadata::parse_bytes(&corrupt).is_err());
    assert!(metadata::parse_bytes(&bytes[..bytes.len() / 2]).is_err());
}

#[test]
#[ignore = "Download public fixtures with npm run fixtures:download first"]
fn reconstructs_gameplay_for_selected_players_without_private_strings() {
    for file in ["epic.replay", "rlcs.replay", "rumble.replay"] {
        let path = fixture_folder().join(file);
        let metadata = metadata::parse_file(&path).unwrap();
        let index = metadata
            .players
            .iter()
            .position(|p| !p.is_bot && p.team.is_some())
            .unwrap();
        let p = &metadata.players[index];
        let target = player::PlayerTarget {
            index,
            name: p.name.clone(),
            team: p.team,
        };
        if file != "epic.replay" {
            let error = gameplay::parse_file(&path, &target).unwrap_err();
            assert!(error.contains("Ancien format réseau"));
            continue;
        }
        let (_, dossier) = gameplay::parse_file(&path, &target).unwrap();
        assert!(dossier.quality.decoded_frames > 1000);
        assert!(dossier.quality.target_observed_seconds > 60.0);
        assert!(dossier.quality.coverage_percent >= 80.0);
        assert!(dossier.quality.complete_spatial_percent >= 70.0);
        assert!(dossier.quality.can_assess);
        assert!(
            dossier
                .metrics
                .iter()
                .find(|m| m.key == "meanSpeed")
                .unwrap()
                .value
                .unwrap()
                > 200.0
        );
        assert!(dossier
            .metrics
            .iter()
            .find(|m| m.key == "meanBoost")
            .unwrap()
            .value
            .is_some_and(|v| (0.0..=100.0).contains(&v)));
        assert!(dossier.timeline.len() > 100);
        assert_eq!(dossier.timeline[0].time, 0.0);
        assert!(
            (dossier.timeline.last().unwrap().time - dossier.quality.recording_seconds).abs() < 0.2
        );
        assert_eq!(
            dossier
                .evidence
                .iter()
                .filter(|e| e.kind.ends_with("_goal"))
                .count(),
            2
        );
        assert!(dossier
            .evidence
            .iter()
            .filter(|e| e.kind.ends_with("_goal"))
            .all(|e| e.kind
                == if target.team == Some(1) {
                    "team_goal"
                } else {
                    "opponent_goal"
                }));
        assert!(dossier
            .evidence
            .iter()
            .any(|e| e.kind == "shot_counter_increase"));
        let serialized = serde_json::to_string(&dossier).unwrap();
        for player in &metadata.players {
            assert!(!serialized.contains(&player.name));
        }
        assert!(!serialized.contains("UniqueId"));
        println!(
            "{file}: frames={} coverage={} spatial={} samples={} evidence={} payloadBytes={}",
            dossier.quality.decoded_frames,
            dossier.quality.coverage_percent,
            dossier.quality.complete_spatial_percent,
            dossier.timeline.len(),
            dossier.evidence.len(),
            serialized.len()
        );
    }
}

#[test]
#[ignore = "Download public fixtures with npm run fixtures:download first"]
fn network_metrics_remain_bound_to_each_of_the_six_players() {
    let path = fixture_folder().join("epic.replay");
    let metadata = metadata::parse_file(&path).unwrap();
    let mut means = std::collections::HashSet::new();
    for (index, p) in metadata.players.iter().enumerate() {
        let target = player::PlayerTarget {
            index,
            name: p.name.clone(),
            team: p.team,
        };
        let (_, dossier) = gameplay::parse_file(&path, &target).unwrap();
        assert_eq!(dossier.target, index);
        assert!(dossier.quality.target_observed_seconds > 60.0);
        assert!((0.0..=100.0).contains(&dossier.quality.coverage_percent));
        if dossier.quality.coverage_percent < 90.0 {
            assert!(!dossier.quality.can_assess);
        }
        println!(
            "targetIndex={index} targetCoverage={} spatialCoverage={}",
            dossier.quality.coverage_percent, dossier.quality.complete_spatial_percent
        );
        assert!(
            dossier
                .metrics
                .iter()
                .find(|m| m.key == "meanSpeed")
                .unwrap()
                .value
                .unwrap()
                > 200.0
        );
        means.insert(
            dossier
                .metrics
                .iter()
                .find(|m| m.key == "meanSpeed")
                .unwrap()
                .value
                .unwrap()
                .to_bits(),
        );
    }
    assert!(
        means.len() > 1,
        "Selected player must change the measured metrics"
    );
}
