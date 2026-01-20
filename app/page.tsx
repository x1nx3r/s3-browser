"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Editor, { DiffEditor, loader } from "@monaco-editor/react";

// Define custom terminal-green theme
loader.init().then((monaco) => {
  monaco.editor.defineTheme("terminal-green", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "4ade80" },
      { token: "comment", foreground: "166534", fontStyle: "italic" },
      { token: "keyword", foreground: "22d3ee" },
      { token: "string", foreground: "facc15" },
      { token: "number", foreground: "60a5fa" },
      { token: "operator", foreground: "4ade80" },
      { token: "delimiter", foreground: "4ade80" },
      { token: "type", foreground: "22d3ee" },
    ],
    colors: {
      "editor.background": "#000000",
      "editor.foreground": "#4ade80",
      "editor.lineHighlightBackground": "#052e16",
      "editor.selectionBackground": "#166534",
      "editorCursor.foreground": "#4ade80",
      "editorLineNumber.foreground": "#166534",
      "editorLineNumber.activeForeground": "#4ade80",
      "minimap.background": "#000000",
      "scrollbarSlider.background": "#16653480",
      "scrollbarSlider.hoverBackground": "#4ade8050",
      "diffEditor.insertedTextBackground": "#16653450",
      "diffEditor.removedTextBackground": "#7f1d1d50",
    },
  });
});

interface S3Object {
  key: string;
  lastModified: string;
  size: number;
  isFolder: boolean;
}

interface FolderItem {
  name: string;
  displayName: string;
}

interface FolderContent {
  path: string;
  folders: FolderItem[];
  files: S3Object[];
}

type ViewMode = "browse" | "preview" | "diff";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getFileName(key: string): string {
  return key.split("/").pop() || key;
}

export default function Home() {
  const [content, setContent] = useState<FolderContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("browse");

  // Preview state
  const [selectedFile, setSelectedFile] = useState<S3Object | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [bytesLoaded, setBytesLoaded] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Diff compare state
  const [compareFiles, setCompareFiles] = useState<S3Object[]>([]);
  const [diffOriginal, setDiffOriginal] = useState("");
  const [diffModified, setDiffModified] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);

  const fetchContent = useCallback(async (prefix: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
      const res = await fetch(`/api/bucket${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setContent(data);
      setCurrentPath(prefix);
    } catch {
      setError("Failed to load bucket contents");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFileContent = async (key: string): Promise<string> => {
    const res = await fetch(`/api/bucket/preview?key=${encodeURIComponent(key)}`);
    if (!res.ok || !res.body) throw new Error("Failed to fetch");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let content = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      content += decoder.decode(value, { stream: true });
    }

    return content;
  };

  const fetchPreview = useCallback(async (file: S3Object) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSelectedFile(file);
    setViewMode("preview");
    setPreviewLoading(true);
    setPreviewContent("");
    setBytesLoaded(0);

    try {
      const res = await fetch(
        `/api/bucket/preview?key=${encodeURIComponent(file.key)}`,
        { signal: controller.signal }
      );

      if (!res.ok || !res.body) {
        throw new Error("Failed to fetch preview");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let totalBytes = 0;
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.length;
        const text = decoder.decode(value, { stream: true });
        fullContent += text;

        setPreviewContent(fullContent);
        setBytesLoaded(totalBytes);
      }

      setPreviewLoading(false);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setPreviewContent("-- Failed to load preview");
        setPreviewLoading(false);
      }
    }
  }, []);

  const toggleCompareFile = (file: S3Object) => {
    setCompareFiles((prev) => {
      const exists = prev.find((f) => f.key === file.key);
      if (exists) {
        return prev.filter((f) => f.key !== file.key);
      }
      if (prev.length >= 2) {
        return [prev[1], file];
      }
      return [...prev, file];
    });
  };

  const startComparison = async () => {
    if (compareFiles.length !== 2) return;

    setViewMode("diff");
    setDiffLoading(true);
    setDiffOriginal("");
    setDiffModified("");

    try {
      const [original, modified] = await Promise.all([
        fetchFileContent(compareFiles[0].key),
        fetchFileContent(compareFiles[1].key),
      ]);

      setDiffOriginal(original);
      setDiffModified(modified);
    } catch {
      setDiffOriginal("-- Failed to load");
      setDiffModified("-- Failed to load");
    } finally {
      setDiffLoading(false);
    }
  };

  useEffect(() => {
    fetchContent("");
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchContent]);

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath + folderName + "/";
    fetchContent(newPath);
    closeView();
    setCompareFiles([]);
  };

  const navigateUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = parts.length ? parts.join("/") + "/" : "";
    fetchContent(newPath);
    closeView();
    setCompareFiles([]);
  };

  const closeView = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSelectedFile(null);
    setPreviewContent("");
    setBytesLoaded(0);
    setViewMode("browse");
  };

  const isFileSelected = (file: S3Object) =>
    compareFiles.some((f) => f.key === file.key);

  const panelWidth = viewMode === "browse" ? "w-full" : "w-1/3";

  return (
    <div className="h-screen bg-black text-green-400 font-mono flex">
      {/* File Browser Panel */}
      <div className={`${panelWidth} flex flex-col border-r border-green-600 transition-all`}>
        <div className="border-b border-green-600 p-3 shrink-0">
          <div className="text-green-300">KMP Backup Browser</div>
          <div className="text-green-600 text-sm">
            /{currentPath || "(root)"}
          </div>
        </div>

        {/* Compare toolbar */}
        {content && content.files.length > 0 && (
          <div className="border-b border-green-600 p-2 flex items-center gap-2 text-xs shrink-0">
            <span className="text-green-600">
              Compare: {compareFiles.length}/2 selected
            </span>
            {compareFiles.length === 2 && (
              <button
                onClick={startComparison}
                className="text-cyan-400 hover:text-cyan-200"
              >
                [diff]
              </button>
            )}
            {compareFiles.length > 0 && (
              <button
                onClick={() => setCompareFiles([])}
                className="text-red-400 hover:text-red-200"
              >
                [clear]
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-3 text-green-500">Loading...</div>
          ) : error ? (
            <div className="p-3">
              <span className="text-red-400">{error}</span>
              <button
                onClick={() => fetchContent(currentPath)}
                className="ml-4 text-green-300 hover:text-green-100 underline"
              >
                [Retry]
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black">
                <tr className="border-b border-green-600 text-green-300">
                  <th className="text-left p-2 w-6"></th>
                  <th className="text-left p-2">Name</th>
                  <th className="text-right p-2 w-20">Size</th>
                  <th className="text-right p-2 w-24">Date</th>
                </tr>
              </thead>
              <tbody>
                {currentPath && (
                  <tr className="border-b border-green-900 hover:bg-green-950">
                    <td className="p-2"></td>
                    <td className="p-2" colSpan={3}>
                      <button
                        onClick={navigateUp}
                        className="text-yellow-400 hover:text-yellow-200"
                      >
                        📁 ..
                      </button>
                    </td>
                  </tr>
                )}

                {content?.folders.map((folder) => (
                  <tr
                    key={folder.name}
                    className="border-b border-green-900 hover:bg-green-950"
                  >
                    <td className="p-2"></td>
                    <td className="p-2" colSpan={3}>
                      <button
                        onClick={() => navigateToFolder(folder.name)}
                        className="text-cyan-400 hover:text-cyan-200"
                      >
                        📁 {folder.displayName}
                      </button>
                    </td>
                  </tr>
                ))}

                {content?.files.map((file) => (
                  <tr
                    key={file.key}
                    className={`border-b border-green-900 hover:bg-green-950 ${selectedFile?.key === file.key ? "bg-green-900" : ""
                      }`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={isFileSelected(file)}
                        onChange={() => toggleCompareFile(file)}
                        className="accent-green-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td
                      className="p-2 text-green-400 truncate max-w-[200px] cursor-pointer"
                      onClick={() => fetchPreview(file)}
                    >
                      📄 {getFileName(file.key)}
                    </td>
                    <td className="p-2 text-right text-green-600 text-xs">
                      {formatBytes(file.size)}
                    </td>
                    <td className="p-2 text-right text-green-600 text-xs">
                      {formatDate(file.lastModified)}
                    </td>
                  </tr>
                ))}

                {content?.folders.length === 0 &&
                  content?.files.length === 0 && (
                    <tr>
                      <td className="p-3 text-green-600" colSpan={4}>
                        (empty)
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          )}
        </div>

        <div className="text-green-600 text-xs p-2 border-t border-green-600 shrink-0">
          {content && (
            <>
              {content.folders.length} folder(s), {content.files.length} file(s)
            </>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      {viewMode === "preview" && selectedFile && (
        <div className="flex-1 flex flex-col">
          <div className="border-b border-green-600 p-3 flex items-center justify-between shrink-0 bg-black">
            <div>
              <div className="text-green-300 truncate">
                {getFileName(selectedFile.key)}
              </div>
              <div className="text-green-600 text-xs">
                {previewLoading
                  ? `Loading... ${formatBytes(bytesLoaded)} / ${formatBytes(selectedFile.size)}`
                  : `${formatBytes(selectedFile.size)} • ${formatDate(selectedFile.lastModified)}`}
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/bucket/download?key=${encodeURIComponent(selectedFile.key)}`}
                className="text-blue-400 hover:text-blue-200 text-sm"
              >
                [download]
              </a>
              <button
                onClick={closeView}
                className="text-red-400 hover:text-red-200 text-sm"
              >
                [close]
              </button>
            </div>
          </div>

          <div className="flex-1">
            <Editor
              height="100%"
              language="sql"
              theme="terminal-green"
              value={previewContent || (previewLoading ? "-- Loading..." : "-- No content")}
              options={{
                readOnly: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                fontSize: 12,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      )}

      {/* Diff Panel */}
      {viewMode === "diff" && (
        <div className="flex-1 flex flex-col">
          <div className="border-b border-green-600 p-3 flex items-center justify-between shrink-0 bg-black">
            <div>
              <div className="text-green-300">
                Comparing Files
              </div>
              <div className="text-green-600 text-xs">
                {diffLoading ? "Loading files..." : (
                  <>
                    <span className="text-red-400">{getFileName(compareFiles[0]?.key || "")}</span>
                    {" ← → "}
                    <span className="text-green-400">{getFileName(compareFiles[1]?.key || "")}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={closeView}
              className="text-red-400 hover:text-red-200 text-sm"
            >
              [close]
            </button>
          </div>

          <div className="flex-1">
            {diffLoading ? (
              <div className="h-full flex items-center justify-center bg-black text-green-500">
                Loading files for comparison...
              </div>
            ) : (
              <DiffEditor
                key={`${compareFiles[0]?.key}-${compareFiles[1]?.key}`}
                height="100%"
                language="sql"
                theme="terminal-green"
                original={diffOriginal}
                modified={diffModified}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  wordWrap: "off",
                  automaticLayout: true,
                  renderSideBySide: true,
                  diffWordWrap: "off",
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
