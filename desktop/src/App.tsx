import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile, type FileChange } from "./api";
import { AgentPanel } from "./components/AgentPanel";
import { CodeEditor, type EditorTab } from "./components/CodeEditor";
import { Explorer } from "./components/Explorer";
import { TitleBar } from "./components/TitleBar";
import "./App.css";

const WS_KEY = "agent-ide-kit-workspace";

export default function App() {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [status, setStatus] = useState("Pronto");
  const [sidebar, setSidebar] = useState<"explorer" | "none">("explorer");
  const [agentOpen, setAgentOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingChanges, setPendingChanges] = useState<FileChange[]>([]);

  useEffect(() => {
    const cached = localStorage.getItem(WS_KEY);
    if (cached) setWorkspace(cached);
  }, []);

  const active = tabs.find((t) => t.path === activePath) ?? null;
  const dirty = !!active && active.content !== active.saved;

  const openFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Abrir pasta do projeto",
    });
    if (typeof selected === "string") {
      setWorkspace(selected);
      localStorage.setItem(WS_KEY, selected);
      setTabs([]);
      setActivePath(null);
      setPendingChanges([]);
      setRefreshKey((k) => k + 1);
      setStatus(selected);
    }
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      if (!workspace) return;
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        setActivePath(path);
        setStatus(path);
        return;
      }
      try {
        const text = await readFile(workspace, path);
        setTabs((prev) => [...prev, { path, content: text, saved: text }]);
        setActivePath(path);
        setStatus(path);
      } catch (e) {
        setStatus(`Erro: ${e}`);
      }
    },
    [tabs, workspace],
  );

  const save = useCallback(async () => {
    if (!workspace || !active) return;
    try {
      await writeFile(workspace, active.path, active.content);
      setTabs((prev) =>
        prev.map((t) => (t.path === active.path ? { ...t, saved: t.content } : t)),
      );
      setStatus(`Salvo · ${active.path}`);
    } catch (e) {
      setStatus(`Erro ao salvar: ${e}`);
    }
  }, [active, workspace]);

  const applyChangeToTabs = useCallback((absolutePath: string, text: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === absolutePath);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { path: absolutePath, content: text, saved: text };
        return next;
      }
      return [...prev, { path: absolutePath, content: text, saved: text }];
    });
    setActivePath(absolutePath);
  }, []);

  const onFilesChanged = useCallback(
    (files: FileChange[]) => {
      setRefreshKey((k) => k + 1);
      setPendingChanges((prev) => {
        const map = new Map(prev.map((f) => [f.absolutePath, f]));
        for (const f of files) {
          const existing = map.get(f.absolutePath);
          map.set(f.absolutePath, {
            ...f,
            previousContent: existing?.previousContent ?? f.previousContent,
          });
        }
        return [...map.values()];
      });
      for (const f of files) {
        applyChangeToTabs(f.absolutePath, f.newContent);
      }
      setStatus(`Agent alterou ${files.length} arquivo(s)`);
    },
    [applyChangeToTabs],
  );

  const onKeepAll = useCallback(() => {
    setPendingChanges([]);
    setStatus("Alterações salvas");
  }, []);

  const onUndoAll = useCallback(async () => {
    if (!workspace || pendingChanges.length === 0) return;
    for (const f of [...pendingChanges].reverse()) {
      try {
        if (f.previousContent === null) {
          // arquivo novo: grava vazio / deixa como estava — melhor reescrever anterior inexistente = apagar via write empty? 
          // Sem delete_file ainda: restaura string vazia só se era novo? Melhor write previous if any
          await writeFile(workspace, f.absolutePath, "");
          applyChangeToTabs(f.absolutePath, "");
        } else {
          await writeFile(workspace, f.absolutePath, f.previousContent);
          applyChangeToTabs(f.absolutePath, f.previousContent);
        }
      } catch (e) {
        setStatus(`Undo falhou: ${e}`);
        return;
      }
    }
    setPendingChanges([]);
    setRefreshKey((k) => k + 1);
    setStatus("Undo All aplicado");
  }, [applyChangeToTabs, pendingChanges, workspace]);

  const onReview = useCallback(() => {
    if (pendingChanges[0]) {
      setActivePath(pendingChanges[0].absolutePath);
      setStatus(`Review · ${pendingChanges[0].path}`);
    }
  }, [pendingChanges]);

  const closeTab = useCallback(
    (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (tab && tab.content !== tab.saved) {
        if (!confirm("Fechar sem salvar?")) return;
      }
      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        if (activePath === path) {
          setActivePath(next.length ? next[next.length - 1].path : null);
        }
        return next;
      });
    },
    [activePath, tabs],
  );

  const workspaceName = workspace
    ? workspace.replace(/\\/g, "/").split("/").filter(Boolean).pop()
    : "agent-ide-kit";

  return (
    <div className="ide">
      <TitleBar
        title={workspaceName || "agent-ide-kit"}
        canSave={dirty}
        sidebarOpen={sidebar === "explorer"}
        agentOpen={agentOpen}
        onOpenFolder={() => void openFolder()}
        onSave={() => void save()}
        onToggleSidebar={() => setSidebar((s) => (s === "explorer" ? "none" : "explorer"))}
        onToggleAgent={() => setAgentOpen((v) => !v)}
      />

      <div className="shell">
        <nav className="activity">
          <button
            type="button"
            className={sidebar === "explorer" ? "active" : ""}
            title="Explorer"
            onClick={() => setSidebar((s) => (s === "explorer" ? "none" : "explorer"))}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path fill="currentColor" d="M3 4h8l2 2h8v14H3V4zm2 4v10h14V8H5z" />
            </svg>
          </button>
          <button
            type="button"
            className={agentOpen ? "active" : ""}
            title="Agent"
            onClick={() => setAgentOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path
                fill="currentColor"
                d="M12 2a7 7 0 0 1 7 7v1h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v1a7 7 0 0 1-14 0v-1H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1V9a7 7 0 0 1 7-7zm-3 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
              />
            </svg>
          </button>
          <div className="activity-spacer" />
          <button type="button" title="Abrir pasta" onClick={() => void openFolder()}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path
                fill="currentColor"
                d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"
              />
            </svg>
          </button>
        </nav>

        {sidebar === "explorer" && (
          <Explorer
            workspace={workspace}
            activePath={activePath}
            refreshKey={refreshKey}
            onOpenFile={(p) => void openFile(p)}
            onOpenFolder={() => void openFolder()}
          />
        )}

        <CodeEditor
          tabs={tabs}
          activePath={activePath}
          onSelectTab={setActivePath}
          onCloseTab={closeTab}
          onChange={(value) => {
            if (!activePath) return;
            setTabs((prev) =>
              prev.map((t) => (t.path === activePath ? { ...t, content: value } : t)),
            );
          }}
          onSave={() => void save()}
        />

        {agentOpen && (
          <AgentPanel
            workspace={workspace}
            openPath={activePath}
            pendingChanges={pendingChanges}
            onFilesChanged={onFilesChanged}
            onKeepAll={onKeepAll}
            onUndoAll={() => void onUndoAll()}
            onReview={onReview}
          />
        )}
      </div>

      <footer className="statusbar">
        <span className="sb-item brand-sb">agent-ide-kit</span>
        <span className="sb-item">{dirty ? "● não salvo" : "pronto"}</span>
        <span className="sb-spacer" />
        <span className="sb-item truncate">{status}</span>
        <span className="sb-item">UTF-8</span>
        <span className="sb-item">Agent</span>
      </footer>
    </div>
  );
}
