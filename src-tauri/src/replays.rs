use serde::Serialize;
use std::{collections::HashSet, fs, path::Path, sync::Mutex, time::UNIX_EPOCH};

#[derive(Default)]
pub struct ReplayIndex(Mutex<HashSet<String>>);

impl ReplayIndex {
    pub fn replace(&self, replays: &[ReplayFile]) -> Result<(), String> {
        let paths = replays
            .iter()
            .map(|replay| replay.file_path.clone())
            .collect();
        *self
            .0
            .lock()
            .map_err(|_| "Index indisponible.".to_string())? = paths;
        Ok(())
    }

    pub fn ensure_allowed(&self, path: &str) -> Result<(), String> {
        let paths = self
            .0
            .lock()
            .map_err(|_| "Index indisponible.".to_string())?;
        if paths.contains(path) {
            Ok(())
        } else {
            Err("Ce replay n'appartient pas au dernier scan. Rafraîchis la liste.".into())
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayFile {
    pub file_name: String,
    pub file_path: String,
    pub modified_at: u64,
    pub size_bytes: u64,
    pub game_type: Option<String>,
}

pub fn path_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(str::to_owned)
        .ok_or_else(|| "Le chemin n'est pas encodable en UTF-8.".into())
}

fn is_replay(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("replay"))
}

pub fn scan_directory(path: &str) -> Result<Vec<ReplayFile>, String> {
    let folder =
        fs::canonicalize(path.trim()).map_err(|error| format!("Dossier inaccessible : {error}"))?;
    if !folder.is_dir() {
        return Err("Le chemin doit désigner un dossier.".into());
    }
    let entries = fs::read_dir(&folder)
        .map_err(|error| format!("Impossible de lire le dossier : {error}"))?;
    let mut replays = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("Entrée inaccessible : {error}"))?;
        let file_path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Type inaccessible : {error}"))?;
        // Non récursif : ignore les dossiers et les liens symboliques.
        if !file_type.is_file() || !is_replay(&file_path) {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Métadonnées inaccessibles : {error}"))?;
        let modified_at = metadata
            .modified()
            .map_err(|error| format!("Date inaccessible : {error}"))?
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Date du fichier antérieure à 1970.".to_string())?
            .as_secs();
        replays.push(ReplayFile {
            file_name: entry.file_name().to_string_lossy().into_owned(),
            file_path: path_string(&file_path)?,
            modified_at,
            size_bytes: metadata.len(),
            // TODO : parser l'en-tête avec boxcars ; aucune donnée inventée ici.
            game_type: None,
        });
    }
    replays.sort_by(|left, right| {
        right
            .modified_at
            .cmp(&left.modified_at)
            .then_with(|| left.file_name.cmp(&right.file_name))
    });
    Ok(replays)
}

pub fn validate_replay(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    if !is_replay(path) {
        return Err("Le fichier doit porter l'extension .replay.".into());
    }
    let metadata =
        fs::symlink_metadata(path).map_err(|error| format!("Replay inaccessible : {error}"))?;
    if !metadata.file_type().is_file() || metadata.len() == 0 {
        return Err("Le replay doit être un fichier régulier non vide.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, SystemTime};

    #[test]
    fn scan_filters_and_sorts_real_files_without_recursion() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.replay");
        let recent = dir.path().join("recent.REPLAY");
        fs::write(&old, b"old").unwrap();
        fs::write(&recent, b"recent").unwrap();
        fs::write(dir.path().join("ignore.txt"), b"ignore").unwrap();
        fs::create_dir(dir.path().join("subfolder.replay")).unwrap();
        fs::write(dir.path().join("subfolder.replay/nested.replay"), b"nested").unwrap();
        let now = SystemTime::now();
        fs::OpenOptions::new()
            .write(true)
            .open(old)
            .unwrap()
            .set_modified(now - Duration::from_secs(60))
            .unwrap();
        fs::OpenOptions::new()
            .write(true)
            .open(recent)
            .unwrap()
            .set_modified(now)
            .unwrap();
        let files = scan_directory(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].file_name, "recent.REPLAY");
        assert_eq!(files[1].file_name, "old.replay");
        assert_eq!(files[0].size_bytes, 6);
        assert!(files[0].game_type.is_none());
    }

    #[test]
    fn missing_folder_and_file_as_folder_are_errors() {
        let dir = tempfile::tempdir().unwrap();
        assert!(scan_directory(dir.path().join("missing").to_str().unwrap()).is_err());
        let file = dir.path().join("a.replay");
        fs::write(&file, b"a").unwrap();
        assert!(scan_directory(file.to_str().unwrap()).is_err());
    }

    #[test]
    fn analysis_rejects_unlisted_empty_or_deleted_files() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.replay");
        fs::write(&file, b"data").unwrap();
        let index = ReplayIndex::default();
        let files = scan_directory(dir.path().to_str().unwrap()).unwrap();
        let path = &files[0].file_path;
        assert!(index.ensure_allowed(path).is_err());
        index.replace(&files).unwrap();
        assert!(index.ensure_allowed(path).is_ok());
        assert!(validate_replay(path).is_ok());
        fs::write(&file, b"").unwrap();
        assert!(validate_replay(path).is_err());
        fs::remove_file(&file).unwrap();
        assert!(validate_replay(path).is_err());
        index.replace(&[]).unwrap();
        assert!(index.ensure_allowed(path).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_are_not_scanned_or_analyzed() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("target.txt");
        fs::write(&target, b"data").unwrap();
        let link = dir.path().join("link.replay");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        assert!(scan_directory(dir.path().to_str().unwrap())
            .unwrap()
            .is_empty());
        assert!(validate_replay(link.to_str().unwrap()).is_err());
    }
}
