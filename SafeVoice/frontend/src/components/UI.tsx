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
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-cyan-600 hover:bg-cyan-500 text-slate-950 focus:ring-cyan-500",
    secondary: "bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 focus:ring-slate-500",
    outline: "bg-transparent border border-slate-700 hover:bg-slate-900 text-slate-200 focus:ring-slate-500",
    danger: "bg-rose-950/50 border border-rose-800/70 text-rose-200 hover:bg-rose-900/50 focus:ring-rose-500",
    secure:
      "bg-emerald-950/50 border border-emerald-500/50 hover:border-emerald-300 text-emerald-200 hover:bg-emerald-900/40 focus:ring-emerald-500"
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
    <section className={`bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden relative ${className}`}>
      {isEncrypted && <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-400/70" />}
      {(title || subtitle || isEncrypted) && (
        <div className="border-b border-slate-800 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-2">
                {title}
                {isEncrypted && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">
                    <Lock className="w-3 h-3" /> encrypted
                  </span>
                )}
              </h3>
            )}
            {subtitle && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{subtitle}</p>}
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
    Received: { bg: "bg-sky-950/40 text-sky-300 border-sky-800/40", dot: "bg-sky-400" },
    Acknowledged: { bg: "bg-emerald-950/30 text-emerald-300 border-emerald-800/40", dot: "bg-emerald-400" },
    Triage: { bg: "bg-amber-950/40 text-amber-300 border-amber-800/40", dot: "bg-amber-400" },
    Investigating: { bg: "bg-cyan-950/40 text-cyan-300 border-cyan-800/40", dot: "bg-cyan-400" },
    "Awaiting Reporter": { bg: "bg-violet-950/40 text-violet-300 border-violet-800/40", dot: "bg-violet-400" },
    Remediation: { bg: "bg-teal-950/40 text-teal-300 border-teal-800/40", dot: "bg-teal-400" },
    Closed: { bg: "bg-slate-800 text-slate-300 border-slate-700", dot: "bg-slate-400" }
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
    Low: "bg-slate-800 text-slate-300 border-slate-700",
    Medium: "bg-sky-950/30 text-sky-300 border-sky-900/30",
    High: "bg-amber-950/30 text-amber-300 border-amber-900/30",
    Critical: "bg-rose-950/40 text-rose-300 border-rose-900/40"
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
        <label htmlFor={fieldId} className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>{label}</span>
          {props.required && <span className="text-cyan-300 font-mono text-[10px] uppercase">{t("common.required")}</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">{icon}</div>}
        <input
          id={fieldId}
          aria-describedby={helperId}
          className={`block w-full rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 py-2.5 ${
            icon ? "pl-10" : "pl-3.5"
          } pr-3.5 transition-colors`}
          {...props}
        />
      </div>
      {helperText && <p id={helperId} className="text-[11px] text-slate-400 leading-relaxed">{helperText}</p>}
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
    <div className={`overflow-x-auto w-full border border-slate-800 rounded-lg ${className}`}>
      <table className="min-w-full divide-y divide-slate-800 bg-slate-900/50">
        <thead className="bg-slate-950 text-slate-300">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-semibold tracking-wider font-mono uppercase">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm text-slate-300">{children}</tbody>
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
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
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
              className={`relative inline-block bg-slate-900 border border-slate-800 text-left rounded-lg shadow-2xl ${maxWidth} w-full overflow-hidden`}
            >
              <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between bg-slate-950">
                <h3 id={titleId} className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  aria-label={t("common.cancel")}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                <span className="absolute top-4 left-4 -ml-px h-full w-px bg-slate-800" aria-hidden="true" />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-slate-950 ${
                      event.type === "system"
                        ? "bg-slate-950 text-emerald-400 border border-emerald-500/20"
                        : event.type === "status"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : event.type === "retention"
                            ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-1.5 flex justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-200">{event.title}</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{event.description}</p>
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-400 whitespace-nowrap">{event.timestamp}</div>
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
          isDragActive ? "border-emerald-500 bg-emerald-950/20" : "border-slate-700 hover:border-slate-500 bg-slate-950/50 hover:bg-slate-950"
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
          <Upload className="w-8 h-8 text-slate-400" aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-300">
            {t("evidence.dropPrompt")}
          </p>
          <p className="text-[11px] text-slate-400">{t("evidence.fileTypes")}</p>
        </div>
      </div>

      {error && (
        <div id="fileUploaderError" role="alert" className="flex items-start gap-2 rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {progress !== null && (
        <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800" role="status" aria-live="polite">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-emerald-300 uppercase">{t("evidence.scanning")}</span>
            <span className="text-[10px] font-mono text-slate-400">{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-cyan-400 h-full transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-[10px] font-semibold text-slate-400 font-mono uppercase tracking-wider">{t("evidence.refs", { count: files.length })}</p>
          <ul className="space-y-1.5">
            {files.map((file, idx) => (
              <li key={file.id} className="flex items-center justify-between text-xs font-mono bg-slate-950/60 p-2 rounded border border-slate-800 group">
                <div className="flex items-center gap-2 text-slate-300 truncate max-w-[85%]">
                  <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{file.displayName}</span>
                  <span className="text-[9px] text-slate-300 bg-slate-900 px-1 py-0.5 rounded border border-slate-700">{file.sizeLabel}</span>
                  <span className="text-[9px] text-emerald-300 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-500/10">
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
                  className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
            ? "bg-slate-950 text-slate-100 border-slate-700"
            : "bg-cyan-700 text-white border-cyan-500/40"
        }`}
      >
        <div className="flex items-center justify-between gap-5 mb-1.5 border-b border-white/10 pb-1">
          <span className={`font-semibold ${isReporter ? "text-cyan-300" : "text-white"}`}>
            {isReporter ? t("chat.anonymousReporter") : sender}
          </span>
          <span className={`text-[9px] font-mono ${isReporter ? "text-slate-400" : "text-cyan-100"}`}>{timestamp}</span>
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{text}</p>

        {attachments.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/40">
            <span className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">{t("chat.evidenceRefs")}</span>
            <div className="space-y-1 mt-1">
              {attachments.map((file) => (
                <div key={file.id} className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
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
