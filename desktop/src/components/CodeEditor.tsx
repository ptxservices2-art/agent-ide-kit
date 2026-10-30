import Editor from "@monaco-editor/react";
import { languageFromPath } from "../lang";

export type EditorTab = {
  path: string;
  content: string;
  saved: string;
};

type Props = {
  tabs: EditorTab[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChange: (value: string) => void;
  onSave: () => void;
};

export function CodeEditor({
  tabs,
  activePath,
  onSelectTab,
  onCloseTab,
  onChange,
  onSave,
}: Props) {
  const active = tabs.find((t) => t.path === activePath) ?? null;
  const crumbs = activePath
    ? activePath.replace(/\\/g, "/").split("/").slice(-3).join(" › ")
    : "";

  return (
    <section className="editor-pane">
      <div className="tabs">
        {tabs.length === 0 && <div className="tab muted-tab">nenhum arquivo</div>}
        {tabs.map((tab) => {
          const name = tab.path.replace(/\\/g, "/").split("/").pop();
          const dirty = tab.content !== tab.saved;
          const isActive = tab.path === activePath;
          return (
            <div
              key={tab.path}
              className={`tab${isActive ? " active" : ""}${dirty ? " dirty" : ""}`}
              onClick={() => onSelectTab(tab.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectTab(tab.path);
              }}
              role="tab"
              tabIndex={0}
            >
              <span>{name}</span>
              {dirty && <span className="dirty-dot" />}
              <button
                type="button"
                className="tab-close"
                title="Fechar"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.path);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        <div className="tabs-spacer" />
        <button type="button" className="ghost-btn" disabled={!active || active.content === active.saved} onClick={onSave}>
          Salvar
        </button>
      </div>

      {crumbs && <div className="breadcrumb">{crumbs}</div>}

      <div className="monaco-wrap">
        {active ? (
          <Editor
            path={active.path}
            height="100%"
            theme="vs-dark"
            language={languageFromPath(active.path)}
            value={active.content}
            onChange={(v) => onChange(v ?? "")}
            options={{
              fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: true, scale: 1 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 8 },
              renderLineHighlight: "line",
              cursorBlinking: "smooth",
              smoothScrolling: true,
            }}
            onMount={(editor, monaco) => {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave());
            }}
          />
        ) : (
          <div className="empty-editor">
            <div className="empty-brand">IA-PTX</div>
            <p>Abra uma pasta na barra lateral e comece a editar.</p>
            <p className="muted">O Agent à direita pode criar e alterar arquivos.</p>
          </div>
        )}
      </div>
    </section>
  );
}
