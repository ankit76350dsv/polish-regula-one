import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { CaseSeverity, CaseStatus, EvidenceAttachment } from "../types";
import { useMotionProps } from "../a11y/motion";

interface AppButtonProps {
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "danger" | "secure";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  onClick?: (event: any) => void;
}

export function AppButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  ...props
}: AppButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-cyan-600 hover:bg-cyan-700 text-white focus:ring-cyan-500",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 focus:ring-slate-500",
    outline: "bg-transparent border border-slate-300 hover:bg-slate-550 hover:bg-slate-50 text-slate-700 focus:ring-slate-500",
    danger: "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 focus:ring-rose-500",
    secure:
      "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 focus:ring-emerald-500"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5"
  };

  return (
    <button className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

interface SecureCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  isEncrypted?: boolean;
  className?: string;
  headerAction?: React.ReactNode;
}

export function SecureCard({
  children,
  title,
  subtitle,
  isEncrypted = false,
  className = "",
  headerAction
}: SecureCardProps) {
  return (
    <section className={`bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs relative ${className}`}>
      {isEncrypted && <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-500/70" />}
      {(title || subtitle || isEncrypted) && (
        <div className="border-b border-slate-150 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                {title}
                {isEncrypted && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase">
                    <Lock className="w-3 h-3" /> encrypted
                  </span>
                )}
              </h3>
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const { t } = useTranslation();
  const configs: Record<CaseStatus, { bg: string; dot: string }> = {
    Received: { bg: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
    Acknowledged: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60", dot: "bg-emerald-500" },
    Triage: { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    Investigating: { bg: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500" },
    "Awaiting Reporter": { bg: "bg-violet-50 text-violet-755 border-violet-200", dot: "bg-violet-500" },
    Remediation: { bg: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
    Closed: { bg: "bg-slate-100 text-slate-705 border-slate-200", dot: "bg-slate-400" }
  };

  const config = configs[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}

export function CaseSeverityBadge({ severity }: { severity: CaseSeverity }) {
  const { t } = useTranslation();
  const configs: Record<CaseSeverity, string> = {
    Low: "bg-slate-100 text-slate-700 border-slate-200",
    Medium: "bg-sky-50 text-sky-700 border-sky-200",
    High: "bg-amber-50 text-amber-800 border-amber-200",
    Critical: "bg-rose-50 text-rose-700 border-rose-200"
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${configs[severity]}`}>
      {t(`severity.${severity}`)}
    </span>
  );
}

interface SecureTextFieldProps {
  label?: string;
  helperText?: string;
  icon?: React.ReactNode;
  className?: string;
  id?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value?: any;
  defaultValue?: string;
  disabled?: boolean;
  minLength?: number;
  onChange?: (event: any) => void;
}

export function SecureTextField({
  label,
  helperText,
  icon,
  className = "",
  id,
  ...props
}: SecureTextFieldProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const fieldId = id || generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>{label}</span>
          {props.required && <span className="text-cyan-600 font-mono text-[10px] uppercase">{t("common.required")}</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">{icon}</div>}
        <input
          id={fieldId}
          aria-describedby={helperId}
          className={`block w-full rounded-lg bg-white border border-slate-350 text-slate-900 placeholder-slate-400 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 py-2.5 ${
            icon ? "pl-10" : "pl-3.5"
          } pr-3.5 transition-colors`}
          {...props}
        />
      </div>
      {helperText && <p id={helperId} className="text-[11px] text-slate-500 leading-relaxed">{helperText}</p>}
    </div>
  );
}

export function AppTable({
  headers,
  children,
  className = ""
}: {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto w-full border border-slate-200 rounded-lg ${className}`}>
      <table className="min-w-full divide-y divide-slate-200 bg-white">
        <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-semibold tracking-wider font-mono uppercase">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm text-slate-700">{children}</tbody>
      </table>
    </div>
  );
}

export function AppModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg"
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const { t } = useTranslation();
  const m = useMotionProps();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Remember what was focused before the dialog opened so we can give focus back on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // When the dialog opens: remember focus, move focus inside, and lock background scroll.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    // Esc closes the dialog; Tab is trapped so focus never leaves it (WCAG 2.1.2 / 2.4.3).
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Give focus back to whatever opened the dialog.
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-10 text-center">
            <motion.div
              {...m({ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } })}
              onClick={onClose}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              {...m({
                initial: { scale: 0.96, opacity: 0, y: 12 },
                animate: { scale: 1, opacity: 1, y: 0 },
                exit: { scale: 0.96, opacity: 0, y: 12 }
              })}
              className={`relative inline-block bg-white border border-slate-200 text-left rounded-lg shadow-2xl ${maxWidth} w-full overflow-hidden`}
            >
              <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between bg-slate-50">
                <h3 id={titleId} className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  aria-label={t("common.cancel")}
                  className="rounded-lg p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface TimelineNode {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: string;
}

export function TimelineWidget({ events }: { events: TimelineNode[] }) {
  const { t } = useTranslation();
  if (!events || events.length === 0) {
    return <div className="py-8 text-center text-xs text-slate-400 italic">{t("noEvents")}</div>;
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, eventIdx) => (
          <li key={event.id}>
            <div className="relative pb-8">
              {eventIdx !== events.length - 1 && (
                <span className="absolute top-4 left-4 -ml-px h-full w-px bg-slate-200" aria-hidden="true" />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white ${
                      event.type === "system"
                        ? "bg-white text-emerald-600 border border-emerald-200"
                        : event.type === "status"
                          ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                          : event.type === "retention"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-700 border border-slate-250"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-1.5 flex justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-900">{event.title}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{event.description}</p>
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-500 whitespace-nowrap">{event.timestamp}</div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AttachmentUploaderProps {
  onFilesChanged: (files: EvidenceAttachment[]) => void;
  files: EvidenceAttachment[];
}

const normalizeExtension = (name: string): EvidenceAttachment["extension"] | null => {
  const ext = name.split(".").pop()?.toUpperCase();
  if (ext === "JPEG") return "JPG";
  if (ext === "PDF" || ext === "PNG" || ext === "JPG" || ext === "XML" || ext === "DOCX") return ext;
  return null;
};

const formatSize = (size: number) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export function AttachmentUploader({ onFilesChanged, files }: AttachmentUploaderProps) {
  const { t } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const simulateProgress = (nextFiles: EvidenceAttachment[]) => {
    setProgress(15);
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev === null) return null;
        if (prev >= 100) {
          window.clearInterval(interval);
          window.setTimeout(() => setProgress(null), 500);
          onFilesChanged(nextFiles.map((file) => ({ ...file, status: "Metadata stripped", metadataStripped: true })));
          return 100;
        }
        return prev + 17;
      });
    }, 120);
  };

  const addFile = (file: File) => {
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
    const sanitizedFile: EvidenceAttachment = {
      id,
      displayName: `Evidence ${files.length + 1} (${extension})`,
      extension,
      sizeLabel: formatSize(file.size),
      status: "Malware scan pending",
      metadataStripped: false,
      originalNameStored: false,
      uploadedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      storageVaultRef: `vault://safevoice/evidence/${id}`
    };

    const nextFiles = [...files, sanitizedFile];
    onFilesChanged(nextFiles);
    simulateProgress(nextFiles);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) addFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) addFile(e.target.files[0]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    onFilesChanged(files.filter((_, index) => index !== idx));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer focus-within:border-cyan-500 ${
          isDragActive ? "border-emerald-500 bg-emerald-50/50" : "border-slate-300 hover:border-slate-450 bg-slate-550 bg-slate-50/50 hover:bg-slate-100/30"
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
          <p className="text-[11px] text-slate-500">{t("evidence.fileTypes")}</p>
        </div>
      </div>

      {error && (
        <div id="fileUploaderError" role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {progress !== null && (
        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200" role="status" aria-live="polite">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-emerald-700 uppercase">{t("evidence.scanning")}</span>
            <span className="text-[10px] font-mono text-slate-500">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-cyan-500 h-full transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-[10px] font-semibold text-slate-500 font-mono uppercase tracking-wider">{t("evidence.refs", { count: files.length })}</p>
          <ul className="space-y-1.5">
            {files.map((file, idx) => (
              <li key={file.id} className="flex items-center justify-between text-xs font-mono bg-white p-2 rounded border border-slate-200 group">
                <div className="flex items-center gap-2 text-slate-700 truncate max-w-[85%]">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span className="truncate">{file.displayName}</span>
                  <span className="text-[9px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{file.sizeLabel}</span>
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
                  className="text-slate-550 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
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

export function ChatBubble({
  sender,
  text,
  timestamp,
  attachments = []
}: {
  sender: string;
  text: string;
  timestamp: string;
  attachments?: EvidenceAttachment[];
  key?: React.Key;
}) {
  const { t } = useTranslation();
  const isReporter = sender === "Reporter" || sender === "Anonymous Whistleblower";

  return (
    <div className={`flex ${isReporter ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[78%] rounded-lg p-3.5 text-xs shadow-md border ${
          isReporter
            ? "bg-slate-50 text-slate-800 border-slate-200"
            : "bg-cyan-600 text-white border-cyan-500/20"
        }`}
      >
        <div className="flex items-center justify-between gap-5 mb-1.5 border-b border-slate-200/40 pb-1">
          <span className={`font-semibold ${isReporter ? "text-cyan-700" : "text-white"}`}>
            {isReporter ? t("chat.anonymousReporter") : sender}
          </span>
          <span className={`text-[9px] font-mono ${isReporter ? "text-slate-500" : "text-cyan-105"}`}>{timestamp}</span>
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{text}</p>

        {attachments.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/60">
            <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">{t("chat.evidenceRefs")}</span>
            <div className="space-y-1 mt-1">
              {attachments.map((file) => (
                <div key={file.id} className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-700 bg-white px-2 py-1 rounded border border-slate-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                  <span className="truncate">{file.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
