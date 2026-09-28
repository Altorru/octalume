use crate::ai::{valid_model_id, AiProvider};
use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION},
    Client,
};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashSet},
    time::Duration,
};

const MAX_BYTES: usize = 2 * 1024 * 1024;
const MAX_PAGES: usize = 20;
const MAX_MODELS: usize = 5000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModel {
    id: String,
    label: String,
}

fn request_parts(provider: AiProvider, api_key: &str) -> Result<(&'static str, HeaderMap), String> {
    if api_key.trim().is_empty()
        || api_key.len() > 4096
        || api_key.bytes().any(|b| b.is_ascii_control())
    {
        return Err("Renseigne une clé API valide pour ce fournisseur.".into());
    }
    let mut secret =
        HeaderValue::from_str(api_key.trim()).map_err(|_| "Clé API invalide.".to_string())?;
    secret.set_sensitive(true);
    let mut headers = HeaderMap::new();
    let url = match provider {
        AiProvider::Openai => {
            let mut bearer = HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
                .map_err(|_| "Clé API invalide.".to_string())?;
            bearer.set_sensitive(true);
            headers.insert(AUTHORIZATION, bearer);
            "https://api.openai.com/v1/models"
        }
        AiProvider::Gemini => {
            headers.insert("x-goog-api-key", secret);
            "https://generativelanguage.googleapis.com/v1beta/models"
        }
        AiProvider::Claude => {
            headers.insert("x-api-key", secret);
            headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
            "https://api.anthropic.com/v1/models"
        }
        AiProvider::Demo => {
            return Err("Le mode démonstration n'a pas de catalogue distant.".into())
        }
    };
    Ok((url, headers))
}

fn parse_page(
    provider: AiProvider,
    value: &Value,
) -> Result<(Vec<AiModel>, Option<String>), String> {
    let field = if provider == AiProvider::Gemini {
        "models"
    } else {
        "data"
    };
    // Gemini omet parfois le champ répété pour un catalogue vide.
    let empty = Vec::new();
    let entries =
        if provider == AiProvider::Gemini && value.get(field).is_none() && value.is_object() {
            &empty
        } else {
            value[field]
                .as_array()
                .ok_or_else(|| "Catalogue fournisseur invalide.".to_string())?
        };
    let mut models = Vec::new();
    for entry in entries {
        if provider == AiProvider::Gemini
            && !entry["supportedGenerationMethods"]
                .as_array()
                .is_some_and(|methods| methods.iter().any(|m| m == "generateContent"))
        {
            continue;
        }
        let id = if provider == AiProvider::Gemini {
            entry["name"]
                .as_str()
                .and_then(|name| name.strip_prefix("models/"))
        } else {
            entry["id"].as_str()
        }
        .ok_or_else(|| "Identifiant manquant dans le catalogue.".to_string())?;
        if !valid_model_id(provider, id) {
            continue;
        }
        let label_field = if provider == AiProvider::Gemini {
            "displayName"
        } else {
            "display_name"
        };
        let label = entry[label_field]
            .as_str()
            .filter(|label| {
                !label.is_empty() && label.len() <= 256 && !label.chars().any(char::is_control)
            })
            .unwrap_or(id);
        models.push(AiModel {
            id: id.into(),
            label: label.into(),
        });
    }
    let cursor = match provider {
        AiProvider::Gemini => value
            .get("nextPageToken")
            .map(|v| {
                v.as_str()
                    .ok_or_else(|| "Pagination du catalogue invalide.".to_string())
            })
            .transpose()?,
        AiProvider::Claude => {
            let more = value["has_more"]
                .as_bool()
                .ok_or_else(|| "Pagination du catalogue invalide.".to_string())?;
            if more {
                Some(
                    value["last_id"]
                        .as_str()
                        .filter(|id| !id.is_empty())
                        .ok_or_else(|| "Pagination du catalogue invalide.".to_string())?,
                )
            } else {
                None
            }
        }
        _ => None,
    }
    .filter(|v| !v.is_empty())
    .map(str::to_owned);
    if cursor
        .as_ref()
        .is_some_and(|v| v.len() > 4096 || v.chars().any(char::is_control))
    {
        return Err("Pagination du catalogue invalide.".into());
    }
    Ok((models, cursor))
}

fn catalog_error(status: u16) -> String {
    match status {
        400 | 401 | 403 => format!("Clé refusée ou permission de lire les modèles absente (HTTP {status}). Vérifie ta clé et ton compte API."),
        429 => "Limite du catalogue atteinte. Réessaie plus tard et vérifie ton quota.".into(),
        _ => format!("Impossible de récupérer le catalogue (HTTP {status}). Aucun modèle n'a été enregistré."),
    }
}

pub async fn list(provider: AiProvider, api_key: String) -> Result<Vec<AiModel>, String> {
    let (url, headers) = request_parts(provider, &api_key)?;
    let client = Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|_| "Impossible d'initialiser la connexion sécurisée.".to_string())?;
    // Une limite globale couvre aussi les catalogues paginés.
    tokio::time::timeout(Duration::from_secs(60), async {
        let mut catalog = BTreeMap::new();
        let mut cursor: Option<String> = None;
        let mut seen = HashSet::new();
        let mut total_bytes = 0usize;
        for _ in 0..MAX_PAGES {
            let mut request = client.get(url).headers(headers.clone());
            match provider {
                AiProvider::Gemini => {
                    request = request.query(&[("pageSize", "1000")]);
                    if let Some(token) = &cursor { request = request.query(&[("pageToken", token)]); }
                }
                AiProvider::Claude => {
                    request = request.query(&[("limit", "1000")]);
                    if let Some(token) = &cursor { request = request.query(&[("after_id", token)]); }
                }
                _ => {}
            }
            let mut response = request.send().await.map_err(|_| "Catalogue inaccessible : vérifie ton réseau ou réessaie plus tard.".to_string())?;
            if !response.status().is_success() { return Err(catalog_error(response.status().as_u16())); }
            if response.content_length().is_some_and(|len| len > MAX_BYTES as u64) { return Err("Catalogue trop volumineux.".into()); }
            let mut bytes = Vec::new();
            while let Some(chunk) = response.chunk().await.map_err(|_| "Lecture du catalogue interrompue.".to_string())? {
                total_bytes = total_bytes.saturating_add(chunk.len());
                if total_bytes > MAX_BYTES { return Err("Catalogue trop volumineux.".into()); }
                bytes.extend_from_slice(&chunk);
            }
            let value: Value = serde_json::from_slice(&bytes).map_err(|_| "Catalogue fournisseur invalide.".to_string())?;
            let (models, next) = parse_page(provider, &value)?;
            for model in models { catalog.insert(model.id.clone(), model); }
            if catalog.len() > MAX_MODELS { return Err("Catalogue trop volumineux.".into()); }
            if let Some(next) = next {
                if !seen.insert(next.clone()) { return Err("Pagination du catalogue incohérente.".into()); }
                cursor = Some(next);
            } else { return Ok(catalog.into_values().collect()); }
        }
        Err("Le catalogue dépasse la limite de pagination. Aucun résultat partiel n'est enregistré.".into())
    }).await.map_err(|_| "Le catalogue n'a pas répondu dans le délai de 60 secondes.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn requests_use_fixed_hosts_and_secret_headers() {
        for provider in [AiProvider::Openai, AiProvider::Gemini, AiProvider::Claude] {
            let (url, headers) = request_parts(provider, "fake-key").unwrap();
            assert!(url.ends_with("/models"));
            assert!(!url.contains("fake-key"));
            assert!(headers.values().any(HeaderValue::is_sensitive));
        }
        assert!(request_parts(AiProvider::Demo, "fake-key").is_err());
        assert!(request_parts(AiProvider::Gemini, "key\nheader").is_err());
        assert!(request_parts(AiProvider::Gemini, "").is_err());
    }

    #[test]
    fn gemini_filters_generation_and_preserves_exact_id() {
        let (models, next) = parse_page(AiProvider::Gemini, &json!({"models":[
            {"name":"models/gemini-example-001","displayName":"Gemini Example","supportedGenerationMethods":["generateContent"]},
            {"name":"models/embed-example","supportedGenerationMethods":["embedContent"]},
            {"name":"models/../bad","supportedGenerationMethods":["generateContent"]}
        ],"nextPageToken":"page2"})).unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "gemini-example-001");
        assert_eq!(next.as_deref(), Some("page2"));
        assert!(parse_page(AiProvider::Gemini, &json!({}))
            .unwrap()
            .0
            .is_empty());
    }

    #[test]
    fn parses_openai_and_claude_without_guessing_capabilities() {
        let (models, next) = parse_page(
            AiProvider::Openai,
            &json!({"data":[{"id":"ft:gpt-example:org:custom:123"}]}),
        )
        .unwrap();
        assert_eq!(models[0].id, "ft:gpt-example:org:custom:123");
        assert!(next.is_none());
        let (models, next) = parse_page(AiProvider::Claude, &json!({"data":[{"id":"claude-example","display_name":"Claude Example"}],"has_more":true,"last_id":"claude-example"})).unwrap();
        assert_eq!(models[0].label, "Claude Example");
        assert_eq!(next.as_deref(), Some("claude-example"));
        assert!(parse_page(AiProvider::Claude, &json!({"data":[],"has_more":true})).is_err());
        assert!(parse_page(AiProvider::Openai, &json!({"data":"invalid"})).is_err());
    }
}
