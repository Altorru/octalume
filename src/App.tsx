import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  ArrowUpRight,
  FileVideo,
  FolderOpen,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import CoachingReport from "./components/CoachingReport";
import type { CoachingReportData, ReplayFile } from "./types";
import "./App.css";

const API_KEY_STORAGE = "octalume.apiKey";
const FOLDER_STORAGE = "octalume.replayFolder";

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
  const [apiKey, setApiKey] = useState(() => storedValue(API_KEY_STORAGE));
  const [folderPath, setFolderPath] = useState(() =>
    storedValue(FOLDER_STORAGE),
  );
  const [replays, setReplays] = useState<ReplayFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [analyzingPath, setAnalyzingPath] = useState<string | null>(null);
  const [report, setReport] = useState<CoachingReportData | null>(null);
  const [reportFile, setReportFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const busy = scanning || analyzingPath !== null;

  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem(API_KEY_STORAGE, apiKey);
      else localStorage.removeItem(API_KEY_STORAGE);
      setStorageError(null);
    } catch {
      setStorageError(
        "La clé reste utilisable, mais son enregistrement local a échoué.",
      );
    }
  }, [apiKey]);

  useEffect(() => {
    // React StrictMode rejoue les effets en développement, pas le scan.
    if (initialized.current) return;
    initialized.current = true;
    if (!isTauri()) {
      setError(
        "Cette page est une prévisualisation. Lance npm run tauri dev pour lire tes replays.",
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

  async function refresh() {
    if (operation.current) return;
    operation.current = true;
    setScanning(true);
    setError(null);
    setReport(null);
    setReplays([]);
    setLastScan(null);
    try {
      const path = folderPath.trim();
      setReplays(await invoke<ReplayFile[]>("scan_replays", { path }));
      setLastScan(new Date());
      try {
        localStorage.setItem(FOLDER_STORAGE, path);
      } catch {
        /* Le scan reste utilisable. */
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setScanning(false);
      operation.current = false;
    }
  }

  async function analyze(replay: ReplayFile) {
    if (operation.current) return;
    operation.current = true;
    setAnalyzingPath(replay.filePath);
    setError(null);
    setReport(null);
    try {
      const result = await invoke<CoachingReportData>("analyze_replay", {
        filePath: replay.filePath,
        apiKey: apiKey.trim(),
      });
      setReportFile(replay.fileName);
      setReport(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setAnalyzingPath(null);
      operation.current = false;
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-slate-950/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
              <Sparkles size={22} aria-hidden="true" />
            </span>
            <span className="text-xl font-bold tracking-tight">
              Octalume
              <span className="ml-3 text-xs font-normal text-slate-500">
                PREVIEW 0.1
              </span>
            </span>
          </div>
          <span className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck
              size={16}
              className="text-emerald-400"
              aria-hidden="true"
            />
            Lecture locale, sur demande
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-cyan-300">REPLAY INTELLIGENCE</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              Chaque match a quelque chose à t'apprendre.
            </h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-slate-400">
              Retrouve tes replays et transforme tes décisions en pistes de
              progression.
            </p>
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside
            className="panel h-fit space-y-6 p-6"
            aria-labelledby="settings-title"
          >
            <h2 id="settings-title" className="text-lg font-semibold">
              Ton espace de jeu
            </h2>
            <div>
              <label
                htmlFor="api-key"
                className="mb-2 flex items-center gap-2 text-sm font-medium"
              >
                <KeyRound size={16} aria-hidden="true" />
                Clé API
              </label>
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Clé de démonstration"
                className="input"
              />
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Une valeur non vide suffit pour tester. Stockage en clair sur
                cet appareil pour ce prototype.
              </p>
              <button
                type="button"
                onClick={() => setApiKey("")}
                disabled={!apiKey}
                className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white disabled:opacity-40"
              >
                <Trash2 size={14} aria-hidden="true" />
                Oublier la clé
              </button>
              {storageError && (
                <p role="alert" className="mt-2 text-xs text-amber-300">
                  {storageError}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="replay-folder"
                className="mb-2 flex items-center gap-2 text-sm font-medium"
              >
                <FolderOpen size={16} aria-hidden="true" />
                Dossier des replays
              </label>
              <input
                id="replay-folder"
                value={folderPath}
                disabled={busy}
                spellCheck={false}
                onChange={(event) => setFolderPath(event.target.value)}
                placeholder="Chemin vers TAGame/Demos"
                className="input"
              />
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Le dossier est lu au lancement et quand tu rafraîchis la liste.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={busy || !folderPath.trim()}
              className="button-primary w-full"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={scanning ? "animate-spin" : ""}
              />
              {scanning ? "Lecture du dossier…" : "Rafraîchir la liste"}
            </button>
            <div className="border-t border-white/10 pt-5 text-xs leading-relaxed text-slate-500">
              Aucun watcher. Aucune injection dans le jeu. Aucun replay transmis
              dans cette version.
            </div>
          </aside>
          <section
            className="min-w-0 space-y-5"
            aria-labelledby="replays-title"
            aria-busy={busy}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="panel p-5">
                <p className="eyebrow">REPLAYS LOCAUX</p>
                <p className="mt-2 text-3xl font-semibold">{replays.length}</p>
              </div>
              <div className="panel p-5">
                <p className="eyebrow">DERNIÈRE LECTURE</p>
                <p className="mt-3 text-lg font-medium">
                  {scanning
                    ? "En cours…"
                    : lastScan
                      ? lastScan.toLocaleTimeString("fr-FR")
                      : "À effectuer"}
                </p>
              </div>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-300"
              >
                {error}
              </p>
            )}
            <div className="panel overflow-hidden">
              <div className="border-b border-white/10 p-5">
                <h2 id="replays-title" className="text-lg font-semibold">
                  Bibliothèque de replays
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Les plus récemment modifiés apparaissent en premier.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Replays locaux triés par date de modification décroissante
                  </caption>
                  <thead className="bg-slate-950/40 text-xs text-slate-500">
                    <tr>
                      <th scope="col" className="p-4">
                        Fichier
                      </th>
                      <th scope="col" className="p-4">
                        Modifié le
                      </th>
                      <th scope="col" className="p-4">
                        Taille
                      </th>
                      <th scope="col" className="p-4">
                        Game Type
                      </th>
                      <th scope="col" className="p-4">
                        Analyse
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {replays.map((replay) => (
                      <tr
                        key={replay.filePath}
                        className="border-t border-white/5"
                      >
                        <td className="max-w-48 break-all p-4 font-medium">
                          {replay.fileName}
                        </td>
                        <td className="whitespace-nowrap p-4 text-xs text-slate-400">
                          {new Date(replay.modifiedAt * 1000).toLocaleString(
                            "fr-FR",
                          )}
                        </td>
                        <td className="whitespace-nowrap p-4 text-slate-400">
                          {(replay.sizeBytes / 1024 / 1024).toFixed(2)} Mio
                        </td>
                        <td className="p-4 text-slate-400">
                          {replay.gameType ?? "À extraire"}
                        </td>
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => void analyze(replay)}
                            disabled={busy || !apiKey.trim()}
                            className="button-primary"
                          >
                            {analyzingPath === replay.filePath ? (
                              <LoaderCircle
                                size={16}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <ArrowUpRight size={16} aria-hidden="true" />
                            )}
                            {analyzingPath === replay.filePath
                              ? "Analyse…"
                              : "Analyser"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {replays.length === 0 && (
                <div className="flex flex-col items-center px-6 py-16 text-center">
                  <FileVideo
                    size={36}
                    className="mb-5 text-slate-600"
                    aria-hidden="true"
                  />
                  <p className="font-medium">
                    {scanning
                      ? "Lecture de tes replays…"
                      : "Ta prochaine progression commence ici."}
                  </p>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                    {scanning
                      ? "Le dossier est lu une seule fois."
                      : "Enregistre un replay dans Rocket League, indique son dossier puis rafraîchis la liste."}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
        <div aria-live="polite">
          {report && (
            <section className="space-y-4">
              <h2 className="break-all text-xl font-semibold">
                Rapport · {reportFile}
              </h2>
              {report.isMock && (
                <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-300">
                  Rapport de démonstration : les données ci-dessous sont
                  fictives et identiques pour tous les replays. Aucun appel à
                  une API n'a eu lieu.
                </p>
              )}
              <CoachingReport report={report} />
            </section>
          )}
        </div>
        <footer className="border-t border-white/5 pt-6 text-xs text-slate-600">
          Octalume · Client open source · Indépendant de Psyonix et Epic Games
        </footer>
      </main>
    </div>
  );
}
