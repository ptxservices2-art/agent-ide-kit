import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Props = {
  title?: string;
  canSave: boolean;
  sidebarOpen: boolean;
  agentOpen: boolean;
  onOpenFolder: () => void;
  onSave: () => void;
  onToggleSidebar: () => void;
  onToggleAgent: () => void;
};

const MENUS: { id: string; label: string; items: { label: string; action?: string; disabled?: boolean }[] }[] = [
  {
    id: "file",
    label: "File",
    items: [
      { label: "Open Folder…", action: "openFolder" },
      { label: "Save", action: "save" },
      { label: "—", disabled: true },
      { label: "Exit", action: "exit" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { label: "Undo", disabled: true },
      { label: "Redo", disabled: true },
      { label: "—", disabled: true },
      { label: "Find", disabled: true },
    ],
  },
  {
    id: "selection",
    label: "Selection",
    items: [{ label: "Select All", disabled: true }],
  },
  {
    id: "view",
    label: "View",
    items: [
      { label: "Toggle Explorer", action: "toggleSidebar" },
      { label: "Toggle Agent", action: "toggleAgent" },
    ],
  },
  { id: "go", label: "Go", items: [{ label: "Go to File…", disabled: true }] },
  { id: "run", label: "Run", items: [{ label: "Run Agent", disabled: true }] },
  { id: "terminal", label: "Terminal", items: [{ label: "New Terminal", disabled: true }] },
  { id: "help", label: "Help", items: [{ label: "About agent-ide-kit", action: "about" }] },
];

export function TitleBar({
  title = "agent-ide-kit",
  canSave,
  sidebarOpen,
  agentOpen,
  onOpenFolder,
  onSave,
  onToggleSidebar,
  onToggleAgent,
}: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const win = getCurrentWindow();
    void win.isMaximized().then(setMaximized);
    const un = win.onResized(() => {
      void win.isMaximized().then(setMaximized);
    });
    return () => {
      void un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function runAction(action?: string) {
    setOpenMenu(null);
    if (!action) return;
    if (action === "openFolder") onOpenFolder();
    if (action === "save" && canSave) onSave();
    if (action === "toggleSidebar") onToggleSidebar();
    if (action === "toggleAgent") onToggleAgent();
    if (action === "about") alert("agent-ide-kit — IDE com Agent Groq");
    if (action === "exit") await getCurrentWindow().close();
  }

  return (
    <header className="titlebar" ref={rootRef} data-tauri-drag-region>
      <div className="tb-left" data-tauri-drag-region>
        <div className="tb-logo" title="agent-ide-kit" data-tauri-drag-region>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
            <path
              fill="#e8e8e8"
              d="M8 1.2 2 4.2v7.6L8 14.8l6-3V4.2L8 1.2zm0 1.7 4.2 2.1L8 7.1 3.8 5 8 2.9zM3.2 6.2l4.3 2.1v4.8l-4.3-2.2V6.2zm5.3 6.9V8.3l4.3-2.1v4.7L8.5 13.1z"
            />
          </svg>
        </div>

        <nav className="tb-menus">
          {MENUS.map((menu) => (
            <div key={menu.id} className="tb-menu">
              <button
                type="button"
                className={`tb-menu-btn${openMenu === menu.id ? " open" : ""}`}
                onClick={() => setOpenMenu((v) => (v === menu.id ? null : menu.id))}
                onMouseEnter={() => {
                  if (openMenu) setOpenMenu(menu.id);
                }}
              >
                {menu.label}
              </button>
              {openMenu === menu.id && (
                <div className="tb-dropdown">
                  {menu.items.map((item, i) =>
                    item.label === "—" ? (
                      <div key={`${menu.id}-sep-${i}`} className="tb-sep" />
                    ) : (
                      <button
                        key={`${menu.id}-${item.label}`}
                        type="button"
                        className="tb-item"
                        disabled={
                          item.disabled || (item.action === "save" && !canSave)
                        }
                        onClick={() => void runAction(item.action)}
                      >
                        {item.label}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="tb-center" data-tauri-drag-region>
        <span className="tb-title">{title}</span>
      </div>

      <div className="tb-right">
        <button
          type="button"
          className={`tb-icon${sidebarOpen ? " on" : ""}`}
          title="Toggle Primary Sidebar"
          onClick={onToggleSidebar}
        >
          <svg viewBox="0 0 16 16" width="16" height="16">
            <path
              fill="currentColor"
              d="M2 2h12v12H2zm1 1v10h3V3zm4 0v10h7V3z"
            />
          </svg>
        </button>
        <button type="button" className="tb-icon" title="Back" disabled>
          ←
        </button>
        <button type="button" className="tb-icon" title="Forward" disabled>
          →
        </button>
        <span className="tb-profile">agent-ide-kit</span>
        <button
          type="button"
          className={`tb-icon${agentOpen ? " on" : ""}`}
          title="Toggle Agent"
          onClick={onToggleAgent}
        >
          <svg viewBox="0 0 16 16" width="16" height="16">
            <path
              fill="currentColor"
              d="M2 3h12v9H9l-1.5 1.5L6 12H2zm1 1v7h3.7l.8.8.8-.8H13V4z"
            />
          </svg>
        </button>
        <button type="button" className="tb-icon" title="Settings" disabled>
          ⚙
        </button>
        <button
          type="button"
          className="tb-agents"
          onClick={onToggleAgent}
          title="Agents Window"
        >
          Agents Window ↗
        </button>

        <div className="tb-win">
          <button
            type="button"
            className="win-btn"
            title="Minimize"
            onClick={() => void getCurrentWindow().minimize()}
          >
            ─
          </button>
          <button
            type="button"
            className="win-btn"
            title={maximized ? "Restore" : "Maximize"}
            onClick={() => void getCurrentWindow().toggleMaximize()}
          >
            {maximized ? "❐" : "□"}
          </button>
          <button
            type="button"
            className="win-btn close"
            title="Close"
            onClick={() => void getCurrentWindow().close()}
          >
            ×
          </button>
        </div>
      </div>
    </header>
  );
}
