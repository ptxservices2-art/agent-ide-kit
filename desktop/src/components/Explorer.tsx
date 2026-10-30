import { useEffect, useMemo, useState } from "react";
import { gitStatus, listDir, type DirEntry } from "../api";
import { ChevronIcon, FileIcon, ViewIcon } from "../fileIcons";

type Props = {
  workspace: string | null;
  activePath: string | null;
  refreshKey: number;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
};

function norm(p: string) {
  return p.replace(/\\/g, "/").toLowerCase();
}

function TreeNode({
  workspace,
  entry,
  depth,
  activePath,
  refreshKey,
  gitMap,
  onOpenFile,
}: {
  workspace: string;
  entry: DirEntry;
  depth: number;
  activePath: string | null;
  refreshKey: number;
  gitMap: Map<string, { status: string; path: string }>;
  onOpenFile: (path: string) => void;
}) {
  const [open, setOpen] = useState(
    depth < 1 && !["node_modules", ".venv", "target", "dist"].includes(entry.name),
  );
  const [children, setChildren] = useState<DirEntry[] | null>(null);

  useEffect(() => {
    if (!entry.isDir || !open) return;
    let cancelled = false;
    listDir(workspace, entry.path)
      .then((rows) => {
        if (!cancelled) setChildren(rows);
      })
      .catch(() => {
        if (!cancelled) setChildren([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.isDir, entry.path, open, workspace, refreshKey]);

  const status = gitMap.get(norm(entry.path))?.status;
  const pad = 8 + depth * 14;

  if (entry.isDir) {
    return (
      <div>
        <button
          type="button"
          className="tree-row"
          style={{ paddingLeft: pad }}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronIcon open={open} />
          <FileIcon name={entry.name} isDir open={open} />
          <span className="tree-name">{entry.name}</span>
          {status && <span className={`git-badge ${status.toLowerCase()}`}>{status}</span>}
        </button>
        {open &&
          children?.map((child) => (
            <TreeNode
              key={child.path}
              workspace={workspace}
              entry={child}
              depth={depth + 1}
              activePath={activePath}
              refreshKey={refreshKey}
              gitMap={gitMap}
              onOpenFile={onOpenFile}
            />
          ))}
      </div>
    );
  }

  const active = activePath === entry.path || (activePath != null && norm(activePath) === norm(entry.path));
  return (
    <button
      type="button"
      className={`tree-row file${active ? " active" : ""}`}
      style={{ paddingLeft: pad + 16 }}
      onClick={() => onOpenFile(entry.path)}
    >
      <FileIcon name={entry.name} />
      <span className="tree-name">{entry.name}</span>
      {status && <span className={`git-badge ${status.toLowerCase()}`}>{status}</span>}
    </button>
  );
}

export function Explorer({
  workspace,
  activePath,
  refreshKey,
  onOpenFile,
  onOpenFolder,
}: Props) {
  const [root, setRoot] = useState<DirEntry[]>([]);
  const [rootOpen, setRootOpen] = useState(true);
  const [view, setView] = useState<"files" | "search" | "git" | "ext">("files");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [gitMap, setGitMap] = useState<Map<string, { status: string; path: string }>>(new Map());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!workspace) {
      setRoot([]);
      setGitMap(new Map());
      return;
    }
    let cancelled = false;
    listDir(workspace)
      .then((rows) => {
        if (!cancelled) setRoot(rows);
      })
      .catch(() => {
        if (!cancelled) setRoot([]);
      });
    gitStatus(workspace)
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, { status: string; path: string }>();
        for (const r of rows) map.set(norm(r.path), { status: r.status, path: r.path });
        setGitMap(map);
      })
      .catch(() => {
        if (!cancelled) setGitMap(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, refreshKey]);

  const title = workspace
    ? workspace.replace(/\\/g, "/").split("/").filter(Boolean).pop()
    : "NO FOLDER";

  const filtered = useMemo(() => {
    if (!query.trim()) return root;
    const q = query.toLowerCase();
    return root.filter((e) => e.name.toLowerCase().includes(q));
  }, [query, root]);

  return (
    <aside className="explorer cursor-explorer">
      <div className="sidebar-views">
        <button
          type="button"
          className={view === "files" ? "active" : ""}
          title="Explorer"
          onClick={() => setView("files")}
        >
          <ViewIcon kind="files" />
        </button>
        <button
          type="button"
          className={view === "search" ? "active" : ""}
          title="Search"
          onClick={() => setView("search")}
        >
          <ViewIcon kind="search" />
        </button>
        <button
          type="button"
          className={view === "git" ? "active" : ""}
          title="Source Control"
          onClick={() => setView("git")}
        >
          <ViewIcon kind="git" />
        </button>
        <button
          type="button"
          className={view === "ext" ? "active" : ""}
          title="Extensions"
          onClick={() => setView("ext")}
        >
          <ViewIcon kind="ext" />
        </button>
        <div className="sidebar-views-spacer" />
        <button type="button" className="ghost-icon" title="Abrir pasta" onClick={onOpenFolder}>
          ▾
        </button>
      </div>

      <div className="explorer-section">
        <button type="button" className="section-title" onClick={() => setRootOpen((v) => !v)}>
          <ChevronIcon open={rootOpen} />
          <span>{title}</span>
        </button>

        {view === "search" && (
          <div className="explorer-search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar arquivos…"
            />
          </div>
        )}

        {view === "git" && (
          <div className="side-placeholder">
            <p>Source Control</p>
            <span className="muted">
              {gitMap.size ? `${gitMap.size} alteração(ões)` : "Nenhuma mudança git"}
            </span>
            <div className="git-list">
              {[...gitMap.values()].slice(0, 40).map((item) => (
                <button
                  key={item.path}
                  type="button"
                  className="tree-row file"
                  onClick={() => onOpenFile(item.path)}
                >
                  <FileIcon name={item.path.replace(/\\/g, "/").split("/").pop() || item.path} />
                  <span className="tree-name">
                    {item.path.replace(/\\/g, "/").split("/").pop()}
                  </span>
                  <span className={`git-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "ext" && (
          <div className="side-placeholder">
            <p>Extensions</p>
            <span className="muted">Em breve</span>
          </div>
        )}

        {(view === "files" || view === "search") && rootOpen && (
          <div className="tree">
            {!workspace && <p className="muted pad">Abra uma pasta para começar.</p>}
            {workspace &&
              filtered.map((entry) => (
                <TreeNode
                  key={entry.path}
                  workspace={workspace}
                  entry={entry}
                  depth={0}
                  activePath={activePath}
                  refreshKey={refreshKey}
                  gitMap={gitMap}
                  onOpenFile={onOpenFile}
                />
              ))}
          </div>
        )}
      </div>

      <div className="explorer-bottom">
        <button type="button" className="section-title bottom" onClick={() => setOutlineOpen((v) => !v)}>
          <ChevronIcon open={outlineOpen} />
          <span>OUTLINE</span>
        </button>
        {outlineOpen && <div className="bottom-empty muted">Sem outline</div>}
        <button
          type="button"
          className="section-title bottom"
          onClick={() => setTimelineOpen((v) => !v)}
        >
          <ChevronIcon open={timelineOpen} />
          <span>TIMELINE</span>
        </button>
        {timelineOpen && <div className="bottom-empty muted">Sem timeline</div>}
      </div>
    </aside>
  );
}
