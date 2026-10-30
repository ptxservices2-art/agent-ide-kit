import type { ReactNode } from "react";

function Svg({
  className,
  children,
  viewBox = "0 0 16 16",
}: {
  className?: string;
  children: ReactNode;
  viewBox?: string;
}) {
  return (
    <svg className={className} viewBox={viewBox} width="16" height="16" aria-hidden>
      {children}
    </svg>
  );
}

export function FolderIcon({ open = false }: { open?: boolean }) {
  return (
    <Svg className={`fi folder${open ? " open" : ""}`}>
      {open ? (
        <path
          fill="#90a4ae"
          d="M1.5 3h4l1 1H14a.5.5 0 0 1 .5.5V6H1v-.5A.5.5 0 0 1 1.5 5zm-.5 4h14l-1.2 5.2A1 1 0 0 1 12.84 13H2.16a1 1 0 0 1-.97-.8z"
        />
      ) : (
        <path
          fill="#90a4ae"
          d="M1.5 2h4.2l1 1H14a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5H1.5A.5.5 0 0 1 1 12.5v-10A.5.5 0 0 1 1.5 2z"
        />
      )}
    </Svg>
  );
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <Svg className={`fi chevron${open ? " open" : ""}`}>
      <path fill="currentColor" d={open ? "M4 6l4 4 4-4z" : "M6 4l4 4-4 4z"} />
    </Svg>
  );
}

function FileGlyph({ color, label }: { color: string; label?: string }) {
  return (
    <Svg className="fi file">
      <path
        fill={color}
        d="M3 1.5A.5.5 0 0 1 3.5 1h6.1L13 4.4V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14z"
      />
      <path fill="rgba(0,0,0,.25)" d="M9.5 1v3h3z" />
      {label && (
        <text
          x="8"
          y="11.5"
          textAnchor="middle"
          fill="#111"
          fontSize="5"
          fontWeight="700"
          fontFamily="Segoe UI, sans-serif"
        >
          {label}
        </text>
      )}
    </Svg>
  );
}

export function FileIcon({ name, isDir, open }: { name: string; isDir?: boolean; open?: boolean }) {
  if (isDir) return <FolderIcon open={!!open} />;

  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";

  if (lower === "package.json" || lower === "package-lock.json") {
    return <FileGlyph color="#8bc34a" label="N" />;
  }
  if (lower === "tsconfig.json" || lower === "tsconfig.node.json") {
    return <FileGlyph color="#3f51b5" label="TS" />;
  }
  if (lower === "cargo.toml" || lower.endsWith(".rs")) {
    return <FileGlyph color="#ff7043" label="Rs" />;
  }
  if (lower === "readme.md") {
    return <FileGlyph color="#42a5f5" label="i" />;
  }
  if (lower.startsWith(".env")) {
    return <FileGlyph color="#ffca28" label="E" />;
  }
  if (lower === ".gitignore") {
    return <FileGlyph color="#ef5350" label="G" />;
  }

  switch (ext) {
    case "tsx":
      return <FileGlyph color="#00bcd4" label="TSX" />;
    case "ts":
      return <FileGlyph color="#3178c6" label="TS" />;
    case "jsx":
      return <FileGlyph color="#61dafb" label="JX" />;
    case "js":
    case "mjs":
    case "cjs":
      return <FileGlyph color="#f7df1e" label="JS" />;
    case "css":
      return <FileGlyph color="#42a5f5" label="#" />;
    case "html":
      return <FileGlyph color="#e44d26" label="<>" />;
    case "json":
      return <FileGlyph color="#cbcb41" label="{}" />;
    case "md":
      return <FileGlyph color="#42a5f5" label="MD" />;
    case "py":
      return <FileGlyph color="#ffd54f" label="Py" />;
    case "toml":
      return <FileGlyph color="#9ccc65" label="T" />;
    case "svg":
      return <FileGlyph color="#ffb74d" label="S" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return <FileGlyph color="#ab47bc" label="img" />;
    case "txt":
      return <FileGlyph color="#bdbdbd" label="txt" />;
    default:
      return <FileGlyph color="#90a4ae" />;
  }
}

export function ViewIcon({ kind }: { kind: "files" | "search" | "git" | "ext" }) {
  if (kind === "files") {
    return (
      <Svg>
        <path fill="currentColor" d="M2 2h5l1 1h6v11H2zm1 2v9h10V4H8L7 3H3z" />
      </Svg>
    );
  }
  if (kind === "search") {
    return (
      <Svg>
        <path
          fill="currentColor"
          d="M6.5 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 1a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm4.7 7.2 2.8 2.8-.7.7-2.8-2.8z"
        />
      </Svg>
    );
  }
  if (kind === "git") {
    return (
      <Svg>
        <path
          fill="currentColor"
          d="M11.5 2a1.5 1.5 0 0 1 .4 2.95L10 6.85V9.5a1.5 1.5 0 1 1-1 0V7.56L6.6 5.16A1.5 1.5 0 1 1 7.3 4.1l2.3 2.3 1.4-1.4A1.5 1.5 0 0 1 11.5 2zM4.5 10A1.5 1.5 0 1 1 4.5 13 1.5 1.5 0 0 1 4.5 10z"
        />
      </Svg>
    );
  }
  return (
    <Svg>
      <path fill="currentColor" d="M2 2h5v5H2zm7 0h5v5H9zM2 9h5v5H2zm7 0h5v5H9z" />
    </Svg>
  );
}
