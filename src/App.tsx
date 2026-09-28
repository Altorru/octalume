import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  Library,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ReplayLibrary, { type ReplayFilter } from "./components/ReplayLibrary";
import ReplayDetails from "./components/ReplayDetails";
import Settings from "./components/Settings";
import { playerTarget, uniquePlayerIndex, reportMatchesTarget } from "./player";
import { providers, savedProvider, type AiProvider } from "./providers";
import type { CoachingReportData, ReplayFile } from "./types";
import "./App.css";

const API_KEY_STORAGE = "octalume.apiKey";
const FOLDER_STORAGE = "octalume.replayFolder";
const PLAYER_STORAGE = "octalume.playerName";
const PROVIDER_STORAGE = "octalume.aiProvider";
type Screen = "library" | "match" | "settings";

function storedValue(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function App() {
  const initialized = useRef(false);
  const operation = useRef(false);
  const [screen, setScreen] = useState<Screen>("library");
  const [settingsOrigin, setSettingsOrigin] = useState<Screen>("library");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ReplayFilter>("all");
  const [playerName, setPlayerName] = useState(() =>
    storedValue(PLAYER_STORAGE),
  );
  const [playerStorageError, setPlayerStorageError] = useState<string | null>(
    null,
  );
  const [playerChoices, setPlayerChoices] = useState<
    Record<string, number | null>
  >({});
  const [provider, setProvider] = useState<AiProvider>(() =>
    savedProvider(storedValue(PROVIDER_STORAGE)),
  );
  const [sessionKeys, setSessionKeys] = useState<Record<AiProvider, string>>({
    demo: "",
    openai: "",
    gemini: "",
    claude: "",
  });
  const [models, setModels] = useState<Record<AiProvider, string>>({
    demo: "",
    openai: providers.openai.model,
    gemini: providers.gemini.model,
    claude: providers.claude.model,
  });
  const apiKey = sessionKeys[provider];
  const model = models[provider];
  function setApiKey(value: string) {
    setSessionKeys((keys) => ({ ...keys, [provider]: value }));
  }
  function setModel(value: string) {
    setModels((values) => ({ ...values, [provider]: value }));
  }
  const [folderPath, setFolderPath] = useState(() =>
    storedValue(FOLDER_STORAGE),
  );
  const [replays, setReplays] = useState<ReplayFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [analyzingPath, setAnalyzingPath] = useState<string | null>(null);
  const [report, setReport] = useState<CoachingReportData | null>(null);
  const [reportPath, setReportPath] = useState("");
  const [selectedReplay, setSelectedReplay] = useState<ReplayFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const busy = scanning || analyzingPath !== null;
  const selectedPlayerIndex = selectedReplay
    ? selectedReplay.filePath in playerChoices
      ? playerChoices[selectedReplay.filePath]
      : uniquePlayerIndex(selectedReplay.metadata?.players ?? [], playerName)
    : null;
  const target = playerTarget(
    selectedReplay?.metadata?.players ?? [],
    selectedPlayerIndex,
  );

  useEffect(() => {
    try {
      if (playerName.trim())
        localStorage.setItem(PLAYER_STORAGE, playerName.trim());
      else localStorage.removeItem(PLAYER_STORAGE);
      setPlayerStorageError(null);
    } catch {
      setPlayerStorageError(
        "Le pseudo reste utilisable, mais son enregistrement a échoué.",
      );
    }
  }, [playerName]);

  function changePlayerName(value: string) {
    setPlayerName(value);
    setPlayerChoices({});
  }

  useEffect(() => {
    try {
      // Migration : l'ancien prototype conservait une clé en clair. Ne jamais la relire ni l'envoyer.
      localStorage.removeItem(API_KEY_STORAGE);
      localStorage.setItem(PROVIDER_STORAGE, provider);
      setStorageError(null);
    } catch {
      setStorageError(
        "Impossible de nettoyer l'ancien stockage ou de mémoriser le fournisseur. Efface les données locales du prototype avant d'utiliser une vraie clé.",
      );
    }
  }, [provider]);

  useEffect(() => {
    // StrictMode ne doit pas déclencher une deuxième lecture du dossier.
    if (initialized.current) return;
    initialized.current = true;
    if (!isTauri()) {
      setError(
        "Prévisualisation web : lance npm run tauri dev pour lire tes replays.",
      );
      return;
    }
    async function initialize() {
      operation.current = true;
      setScanning(true);
      try {
        const path =
          storedValue(FOLDER_STORAGE) ||
          (await invoke<string>("get_replay_folder_path"));
        setFolderPath(path);
        setReplays(await invoke<ReplayFile[]>("scan_replays", { path }));
        setLastScan(new Date());
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setScanning(false);
        operation.current = false;
      }
    }
    void initialize();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("screen-title")?.focus({ preventScroll: true });
  }, [screen, selectedReplay?.filePath]);

  function openSettings() {
    if (screen !== "settings") setSettingsOrigin(screen);
    setScreen("settings");
  }

  async function refresh() {
    if (operation.current || !folderPath.trim()) return;
    operation.current = true;
    setScanning(true);
    setError(null);
    setReport(null);
    setReportPath("");
    setSelectedReplay(null);
    setPlayerChoices({});
    setSettingsOrigin("library");
    setReplays([]);
    setLastScan(null);
    try {
      const path = folderPath.trim();
      setReplays(await invoke<ReplayFile[]>("scan_replays", { path }));
      setLastScan(new Date());
      try {
        localStorage.setItem(FOLDER_STORAGE, path);
      } catch {
        /* Scan utilisable sans persistance. */
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setScanning(false);
      operation.current = false;
    }
  }

  function openReplay(replay: ReplayFile) {
    if (!replay.metadata || replay.parseError) return;
    setSelectedReplay(replay);
    setError(null);
    setScreen("match");
  }

  async function analyze(replay: ReplayFile, consent: boolean) {
    if (
      operation.current ||
      (provider !== "demo" &&
        (!apiKey.trim() || !consent || Boolean(storageError))) ||
      !replay.metadata ||
      replay.parseError ||
      !target ||
      selectedReplay?.filePath !== replay.filePath
    )
      return;
    operation.current = true;
    setAnalyzingPath(replay.filePath);
    setError(null);
    setReport(null);
    setReportPath("");
    setSelectedReplay(replay);
    setScreen("match");
    try {
      const result = await invoke<CoachingReportData>("analyze_replay", {
        filePath: replay.filePath,
        aiConfig: {
          provider,
          model: model.trim(),
          apiKey: apiKey.trim(),
          consent,
        },
        playerTarget: target,
      });
      setReportPath(replay.filePath);
      setReport(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setAnalyzingPath(null);
      operation.current = false;
    }
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>
      <aside className="app-sidebar">
        <button
          className="brand"
          onClick={() => setScreen("library")}
          aria-label="Octalume — ouvrir la bibliothèque"
        >
          <span className="brand-mark">
            <Sparkles size={23} aria-hidden="true" />
          </span>
          <span>
            octalume<span className="brand-subtitle">REPLAY INTELLIGENCE</span>
          </span>
        </button>
        <p className="nav-label">TON ESPACE</p>
        <nav aria-label="Navigation principale" className="main-nav">
          <button
            className={`nav-item ${screen !== "settings" ? "active" : ""}`}
            aria-current={screen !== "settings" ? "page" : undefined}
            onClick={() => setScreen("library")}
          >
            <Library size={18} aria-hidden="true" /> Bibliothèque{" "}
            <span className="nav-count">{replays.length}</span>
          </button>
          <button
            className={`nav-item ${screen === "settings" ? "active" : ""}`}
            aria-current={screen === "settings" ? "page" : undefined}
            onClick={openSettings}
          >
            <Settings2 size={18} aria-hidden="true" /> Réglages
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Ton jeu. Tes fichiers.</strong>
              <p>Lecture locale, uniquement sur demande.</p>
            </div>
          </div>
          <span className="version-label">
            <span className="status-dot" /> CLIENT OPEN SOURCE <span>v0.1</span>
          </span>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Ton espace</span>
            <span>/</span>
            <strong>
              {screen === "settings"
                ? "Réglages"
                : screen === "match"
                  ? "Détails du match"
                  : "Bibliothèque"}
            </strong>
          </div>
          <span className="local-badge">
            <span className="status-dot" /> Local & privé
          </span>
        </header>
        <main
          id="main-content"
          className={`page-content ${screen === "match" ? "match-page" : ""}`}
        >
          {error && (
            <div role="alert" className="notice notice-error">
              <CircleAlert size={18} aria-hidden="true" />
              <div>
                <strong>Impossible de terminer cette action</strong>
                <p>{error}</p>
              </div>
            </div>
          )}
          {screen === "library" && (
            <ReplayLibrary
              replays={replays}
              scanning={scanning}
              busy={busy}
              lastScan={lastScan}
              folderPath={folderPath}
              hasError={Boolean(error)}
              query={query}
              filter={filter}
              onQuery={setQuery}
              onFilter={setFilter}
              onRefresh={() => void refresh()}
              onSettings={openSettings}
              onOpen={openReplay}
            />
          )}
          {screen === "settings" && (
            <>
              <button
                className="back-link"
                onClick={() =>
                  setScreen(
                    settingsOrigin === "match" && selectedReplay
                      ? "match"
                      : "library",
                  )
                }
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {settingsOrigin === "match" && selectedReplay
                  ? "Retour au match"
                  : "Retour à la bibliothèque"}
              </button>
              <Settings
                apiKey={apiKey}
                provider={provider}
                onProvider={setProvider}
                model={model}
                onModel={setModel}
                playerName={playerName}
                onPlayerName={changePlayerName}
                playerStorageError={playerStorageError}
                onApiKey={setApiKey}
                folderPath={folderPath}
                onFolderPath={setFolderPath}
                busy={busy}
                scanning={scanning}
                storageError={storageError}
                onRefresh={() => void refresh()}
                onLibrary={() => setScreen("library")}
              />
            </>
          )}
          {screen === "match" && selectedReplay && (
            <ReplayDetails
              key={selectedReplay.filePath}
              replay={selectedReplay}
              report={
                reportMatchesTarget(
                  report,
                  reportPath,
                  selectedReplay.filePath,
                  target,
                )
                  ? report
                  : null
              }
              playerName={playerName}
              selectedPlayerIndex={selectedPlayerIndex}
              onPlayerSelect={(index) =>
                setPlayerChoices((choices) => ({
                  ...choices,
                  [selectedReplay.filePath]: index,
                }))
              }
              analyzing={analyzingPath === selectedReplay.filePath}
              busy={busy}
              provider={provider}
              model={model}
              hasApiKey={
                provider === "demo" || (Boolean(apiKey.trim()) && !storageError)
              }
              onBack={() => setScreen("library")}
              onAnalyze={(consent) => void analyze(selectedReplay, consent)}
              onSettings={openSettings}
            />
          )}
          <footer className="app-footer">
            <span>Conçu pour comprendre. Jouer pour progresser.</span>
            <span>
              Indépendant de Psyonix & Epic Games{" "}
              <ArrowUpRight size={12} aria-hidden="true" />
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
