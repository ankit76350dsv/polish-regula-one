import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileText, Loader2, Trash2, Upload } from "lucide-react";
import {
  ACCEPT_ATTR,
  MAX_FILES,
  allowedExtensionOf,
  formatSize,
  validateFile,
} from "../../../utils/attachmentPolicy";

// Read a File into a base64 string (WITHOUT the "data:...;base64," prefix), so the
// actual bytes can travel inside the JSON report payload. This is the step that was
// missing before — the old code validated the file then threw the bytes away.
const readAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(","); // strip the "data:mime;base64," header
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });

export function AttachmentUploader({ onFilesChanged, files }) {
  const { t } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Validate and read one or more chosen files, then hand the accepted ones (with their
  // base64 content) back to the parent. Runs for both the file picker and drag-and-drop.
  const addFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    // Reject the whole batch if it would push us over the total-attachment limit.
    if (files.length + incoming.length > MAX_FILES) {
      setError(t("evidence.tooMany", { max: MAX_FILES }));
      return;
    }

    setError("");
    setIsReading(true);
    const accepted = [];
    let lastError = "";

    for (const file of incoming) {
      const errorKey = validateFile(file);
      if (errorKey) {
        lastError = t(errorKey);
        continue;
      }
      const extension = allowedExtensionOf(file.name);
      try {
        const content = await readAsBase64(file);
        accepted.push({
          id: `ev-${Date.now()}-${accepted.length}-${file.size}`,
          fileName: file.name, // the real name, shown only to the reporter in this list
          extension,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          sizeLabel: formatSize(file.size),
          content, // base64 bytes — sent to the backend with the report
        });
      } catch {
        lastError = t("evidence.readError");
      }
    }

    setIsReading(false);
    if (accepted.length > 0) onFilesChanged([...files, ...accepted]);
    if (lastError) setError(lastError);
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
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = ""; // reset so picking the same file again still fires onChange
  };

  const removeFile = (idx) => {
    onFilesChanged(files.filter((_, index) => index !== idx));
  };

  const atLimit = files.length >= MAX_FILES;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors focus-within:border-cyan-500 ${
          atLimit ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${
          isDragActive
            ? "border-emerald-500 bg-emerald-50/50"
            : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-100/30"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={atLimit ? undefined : handleDrop}
        onClick={() => !atLimit && fileInputRef.current?.click()}
      >
        <label htmlFor="fileUploaderInput" className="sr-only">
          {t("report.evidence")}
        </label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={handleFileInput}
          accept={ACCEPT_ATTR}
          id="fileUploaderInput"
          disabled={atLimit}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "fileUploaderError" : undefined}
        />

        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-slate-500" aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-700">
            {atLimit ? t("evidence.limitReached", { max: MAX_FILES }) : t("evidence.dropPrompt")}
          </p>
          <p className="text-[11px] text-slate-500">{t("evidence.fileTypes", { max: MAX_FILES })}</p>
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

      {isReading && (
        <div
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] font-mono text-slate-600"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600" aria-hidden="true" />
          {t("evidence.reading")}
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
                  <span className="truncate">{file.fileName}</span>
                  <span className="text-[9px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                    {file.extension}
                  </span>
                  <span className="text-[9px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                    {file.sizeLabel}
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
