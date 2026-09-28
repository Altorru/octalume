mod ai;
mod analysis_gate;
pub mod gameplay;
pub mod metadata;
mod model_catalog;
pub mod player;
pub mod replays;
mod report;

use replays::{ReplayFile, ReplayIndex};
use report::CoachingReport;
use std::time::Duration;
use tauri::State;

#[tauri::command]
fn get_replay_folder_path() -> Result<String, String> {
    let documents = dirs::document_dir()
        .or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(|profile| std::path::PathBuf::from(profile).join("Documents"))
        })
        .ok_or_else(|| "Impossible de trouver le dossier Documents.".to_string())?;

    replays::path_string(
        &documents
            .join("My Games")
            .join("Rocket League")
            .join("TAGame")
            .join("Demos"),
    )
}

#[tauri::command]
async fn scan_replays(
    path: String,
    index: State<'_, ReplayIndex>,
) -> Result<Vec<ReplayFile>, String> {
    let replays = tauri::async_runtime::spawn_blocking(move || replays::scan_directory(&path))
        .await
        .map_err(|error| format!("Le scan a échoué : {error}"))??;
    index.replace(&replays)?;
    Ok(replays)
}

#[tauri::command]
async fn list_ai_models(
    provider: ai::AiProvider,
    api_key: String,
) -> Result<Vec<model_catalog::AiModel>, String> {
    model_catalog::list(provider, api_key).await
}

#[tauri::command]
async fn get_replay_gameplay(
    file_path: String,
    player_target: player::PlayerTarget,
    index: State<'_, ReplayIndex>,
    gate: State<'_, analysis_gate::AnalysisGate>,
) -> Result<gameplay::GameplayPreview, String> {
    let _permit = gate.acquire()?;
    index.ensure_allowed(&file_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        replays::validate_replay(&file_path)?;
        let (_, dossier) = gameplay::parse_file(std::path::Path::new(&file_path), &player_target)?;
        Ok(dossier.preview())
    })
    .await
    .map_err(|_| "L'extraction du gameplay a échoué.".to_string())?
}

#[tauri::command]
async fn analyze_replay(
    file_path: String,
    ai_config: ai::AiConfig,
    player_target: player::PlayerTarget,
    index: State<'_, ReplayIndex>,
    gate: State<'_, analysis_gate::AnalysisGate>,
) -> Result<CoachingReport, String> {
    let _permit = gate.acquire()?;
    ai_config.validate()?;
    index.ensure_allowed(&file_path)?;
    let parse_target = player_target.clone();
    let demo = ai_config.provider == ai::AiProvider::Demo;
    let (metadata, dossier) = tauri::async_runtime::spawn_blocking(move || {
        replays::validate_replay(&file_path)?;
        if demo {
            metadata::parse_file(std::path::Path::new(&file_path)).map(|metadata| (metadata, None))
        } else {
            gameplay::parse_file(std::path::Path::new(&file_path), &parse_target)
                .map(|(metadata, dossier)| (metadata, Some(dossier)))
        }
    })
    .await
    .map_err(|error| format!("La vérification a échoué : {error}"))??;
    player::validate_target(&metadata.players, &player_target)?;
    if ai_config.provider == ai::AiProvider::Demo {
        tokio::time::sleep(Duration::from_secs(2)).await;
        Ok(CoachingReport::demo(metadata.game_type, player_target))
    } else {
        ai::analyze(
            ai_config,
            metadata,
            player_target,
            dossier.ok_or_else(|| "Gameplay non préparé.".to_string())?,
        )
        .await
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ReplayIndex::default())
        .manage(analysis_gate::AnalysisGate::default())
        .invoke_handler(tauri::generate_handler![
            get_replay_folder_path,
            scan_replays,
            list_ai_models,
            get_replay_gameplay,
            analyze_replay
        ])
        .run(tauri::generate_context!())
        .expect("Impossible de démarrer Octalume");
}
