import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Paperclip, X } from "lucide-react";
import { ACCEPT_ATTR, MAX_FILES, formatSize, validateFile } from "../../utils/attachmentPolicy";

/**
 * Compact "attach files" control for a message composer (staff case thread + reporter
 * tracking page). Unlike the report-submission uploader, it keeps the RAW File objects
 * (not base64) because thread messages are sent as multipart/form-data.
 *
 * Props:
 *   files          File[]  — the currently attached files (owned by the parent)
 *   onFilesChanged (next)  — called with the new File[] on add/remove
 *   disabled       bool    — hide/disable the control (e.g. while sending)
 */
export function MessageComposerAttachments({ files, onFilesChanged, disabled = false }) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    if (files.length + incoming.length > MAX_FILES) {
      setError(t("evidence.tooMany", { max: MAX_FILES }));
      return;
    }
    setError("");
    const accepted = [];
    let lastError = "";
    for (const file of incoming) {
      const errorKey = validateFile(file);
      if (errorKey) {
        lastError = t(errorKey);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) onFilesChanged([...files, ...accepted]);
    if (lastError) setError(lastError);
  };

  const removeAt = (idx) => onFilesChanged(files.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={disabled || files.length >= MAX_FILES}
        onClick={() => inputRef.current?.click()}
        title={t("evidence.attach")}
        aria-label={t("evidence.attach")}
        className="inline-flex items-center gap-1.5 self-start text-[11px] font-semibold text-slate-500 hover:text-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded px-1 py-0.5"
      >
        <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
        {t("evidence.attach")}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        accept={ACCEPT_ATTR}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-[11px] text-rose-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
            >
              <span className="truncate max-w-[10rem]">{file.name}</span>
              <span className="text-[9px] text-slate-500">{formatSize(file.size)}</span>
              <button
                type="button"
                aria-label={t("evidence.removeFile")}
                onClick={() => removeAt(idx)}
                className="text-slate-400 hover:text-rose-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
