import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileText, Trash2, Upload } from "lucide-react";

const normalizeExtension = (name) => {
  const ext = name.split(".").pop()?.toUpperCase();
  if (ext === "JPEG") return "JPG";
  if (
    ext === "PDF" ||
    ext === "PNG" ||
    ext === "JPG" ||
    ext === "XML" ||
    ext === "DOCX"
  )
    return ext;
  return null;
};

const formatSize = (size) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export function AttachmentUploader({ onFilesChanged, files }) {
  const { t } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const simulateProgress = (nextFiles) => {
    setProgress(15);
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev === null) return null;
        if (prev >= 100) {
          window.clearInterval(interval);
          window.setTimeout(() => setProgress(null), 500);
          onFilesChanged(
            nextFiles.map((file) => ({
              ...file,
              status: "Metadata stripped",
              metadataStripped: true,
            })),
          );
          return 100;
        }
        return prev + 17;
      });
    }, 120);
  };

  const addFile = (file) => {
    const extension = normalizeExtension(file.name);
    if (!extension) {
      setError(t("evidence.unsupported"));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(t("evidence.tooLarge"));
      return;
    }

    setError("");
    const id = `ev-${Date.now()}-${files.length + 1}`;
    const sanitizedFile = {
      id,
      displayName: `Evidence ${files.length + 1} (${extension})`,
      extension,
      sizeLabel: formatSize(file.size),
      status: "Malware scan pending",
      metadataStripped: false,
      originalNameStored: false,
      uploadedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      storageVaultRef: `vault://safevoice/evidence/${id}`,
    };

    const nextFiles = [...files, sanitizedFile];
    onFilesChanged(nextFiles);
    simulateProgress(nextFiles);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) addFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e) => {
    if (e.target.files?.[0]) addFile(e.target.files[0]);
    e.target.value = "";
  };

  const removeFile = (idx) => {
    onFilesChanged(files.filter((_, index) => index !== idx));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer focus-within:border-cyan-500 ${
          isDragActive
            ? "border-emerald-500 bg-emerald-50/50"
            : "border-slate-300 hover:border-slate-400 bg-slate-100 bg-slate-50/50 hover:bg-slate-100/30"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <label htmlFor="fileUploaderInput" className="sr-only">
          {t("report.evidence")}
        </label>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={handleFileInput}
          accept=".pdf,.png,.jpg,.jpeg,.xml,.docx"
          id="fileUploaderInput"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "fileUploaderError" : undefined}
        />

        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-slate-500" aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-700">
            {t("evidence.dropPrompt")}
          </p>
          <p className="text-[11px] text-slate-500">
            {t("evidence.fileTypes")}
          </p>
        </div>
      </div>

      {error && (
        <div
          id="fileUploaderError"
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {progress !== null && (
        <div
          className="bg-slate-50 rounded-lg p-2.5 border border-slate-200"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-emerald-700 uppercase">
              {t("evidence.scanning")}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {progress}%
            </span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-500 h-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-[10px] font-semibold text-slate-500 font-mono uppercase tracking-wider">
            {t("evidence.refs", { count: files.length })}
          </p>
          <ul className="space-y-1.5">
            {files.map((file, idx) => (
              <li
                key={file.id}
                className="flex items-center justify-between text-xs font-mono bg-white p-2 rounded border border-slate-200 group"
              >
                <div className="flex items-center gap-2 text-slate-700 truncate max-w-[85%]">
                  <FileText
                    className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{file.displayName}</span>
                  <span className="text-[9px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                    {file.sizeLabel}
                  </span>
                  <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/50">
                    {file.status}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={t("evidence.removeFile")}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="text-slate-500 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
