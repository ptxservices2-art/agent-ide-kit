const MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  rs: "rust",
  py: "python",
  md: "markdown",
  html: "html",
  css: "css",
  scss: "scss",
  toml: "ini",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  bat: "bat",
  ps1: "powershell",
  sql: "sql",
  xml: "xml",
  svg: "xml",
  txt: "plaintext",
};

export function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MAP[ext] ?? "plaintext";
}
