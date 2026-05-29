/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Shield, Lock, FileText, Check, AlertTriangle, ChevronRight, Upload, X, Trash2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CaseStatus, CaseSeverity } from "../types";

// AppButton Component
interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "secure";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  onClick?: (e: any) => void;
  disabled?: boolean;
}

export function AppButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  ...props
}: AppButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500 shadow-lg shadow-indigo-600/10 transition-all",
    secondary: "bg-[#0F1117] hover:bg-slate-800 text-slate-100 hover:text-white focus:ring-slate-600 border border-slate-800",
    outline: "bg-transparent border border-slate-800 hover:bg-[#0F1117] text-slate-250 hover:text-white focus:ring-slate-600",
    danger: "bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:bg-rose-900/40 focus:ring-rose-500",
    secure: "bg-emerald-950/40 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 hover:bg-emerald-900/30 focus:ring-emerald-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

// SecureCard Component with encryption framing
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
  headerAction,
}: SecureCardProps) {
  return (
    <div className={`bg-slate-900/80 border border-slate-850 rounded-xl overflow-hidden relative ${className}`}>
      {isEncrypted && (
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-emerald-500/0" />
      )}
      
      {(title || subtitle || isEncrypted) && (
        <div className="border-b border-slate-800/80 px-5 py-4 flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-2">
                {title}
                {isEncrypted && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium tracking-normal text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">
                    <Lock className="w-[10px] h-[10px]" /> AES-256
                  </span>
                )}
              </h3>
            )}
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

// CaseStatusBadge Component
export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const configs = {
    "Received": {
      bg: "bg-blue-950/40 text-blue-300 border-blue-800/40",
      dot: "bg-blue-400",
      label: "Received",
    },
    "Under Review": {
      bg: "bg-amber-950/40 text-amber-300 border-amber-800/30",
      dot: "bg-amber-400",
      label: "Under Review",
    },
    "Investigating": {
      bg: "bg-indigo-950/40 text-indigo-300 border-indigo-800/40",
      dot: "bg-indigo-400",
      label: "Investigating",
    },
    "Awaiting Information": {
      bg: "bg-purple-950/40 text-purple-300 border-purple-800/30",
      dot: "bg-purple-400",
      label: "Awaiting Info",
    },
    "Closed": {
      bg: "bg-slate-800 text-slate-300 border-slate-700",
      dot: "bg-slate-400",
      label: "Closed",
    },
  };

  const config = configs[status] || configs["Received"];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// CaseSeverityBadge Component
export function CaseSeverityBadge({ severity }: { severity: CaseSeverity }) {
  const configs = {
    "Low": "bg-slate-800 text-slate-300 border-slate-700",
    "Medium": "bg-blue-950/30 text-blue-300 border-blue-900/30",
    "High": "bg-orange-950/30 text-orange-300 border-orange-900/30",
    "Critical": "bg-rose-950/40 text-rose-300 border-rose-900/40 animate-pulse",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${configs[severity]}`}>
      {severity}
    </span>
  );
}

// SecureTextField Component
interface SecureTextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  icon?: React.ReactNode;
  className?: string;
  id?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  value?: any;
  onChange?: (e: any) => any;
  defaultValue?: string;
  disabled?: boolean;
}

export function SecureTextField({
  label,
  helperText,
  icon,
  className = "",
  id,
  ...props
}: SecureTextFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>{label}</span>
          {props.required && <span className="text-emerald-400 font-mono text-[10px] uppercase">Required</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={`block w-full rounded-lg bg-[#0F1117] border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-2.5 ${
            icon ? "pl-10" : "pl-3.5"
          } pr-3.5 transition-colors`}
          {...props}
        />
      </div>
      {helperText && <p className="text-[10px] text-slate-400 leading-relaxed">{helperText}</p>}
    </div>
  );
}

// AppTable Components
export function AppTable({
  headers,
  children,
  className = "",
}: {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto w-full border border-slate-800 rounded-lg ${className}`}>
      <table className="min-w-full divide-y divide-slate-800/80 bg-slate-900/50">
        <thead className="bg-slate-950 text-slate-300">
          <tr>
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold tracking-wider font-mono uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80 text-sm text-slate-300">
          {children}
        </tbody>
      </table>
    </div>
  );
}

// AppModal Component
export function AppModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 transition-opacity bg-slate-950/80 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Trick browser to center */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className={`inline-block align-bottom bg-slate-900 border border-slate-800 text-left rounded-xl shadow-2xl transform transition-all sm:my-8 sm:align-middle ${maxWidth} w-full overflow-hidden`}
            >
              <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between bg-slate-950">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
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

// TimelineWidget Component
interface TimelineNode {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: string;
}

export function TimelineWidget({ events }: { events: TimelineNode[] }) {
  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 italic">
        No case events recorded.
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, eventIdx) => (
          <li key={event.id}>
            <div className="relative pb-8">
              {eventIdx !== events.length - 1 ? (
                <span className="absolute top-4 left-4 -ml-px h-full w-[1px] bg-slate-800" aria-hidden="true" />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-[#0B0C10] ${
                    event.type === "system" ? "bg-[#0B0C10] text-emerald-400 border border-emerald-500/20" :
                    event.type === "status" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                    "bg-slate-850 text-slate-300 border border-slate-800"
                  }`}>
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-xs font-medium text-slate-200">
                      {event.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-500 whitespace-nowrap">
                    {event.timestamp}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// AttachmentUploader Component
interface AttachmentUploaderProps {
  onFilesChanged: (files: string[]) => void;
  files: string[];
}

export function AttachmentUploader({ onFilesChanged, files }: AttachmentUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const simulateProgress = () => {
    setProgress(10);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev === null) return null;
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setProgress(null), 500);
          return 100;
        }
        return prev + 15;
      });
    }, 120);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const addFile = (fileName: string) => {
    if (!files.includes(fileName)) {
      simulateProgress();
      setTimeout(() => {
        onFilesChanged([...files, fileName]);
      }, 900);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      addFile(file.name);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFile(e.target.files[0].name);
    }
  };

  const removeFile = (idx: number) => {
    const updated = [...files];
    updated.splice(idx, 1);
    onFilesChanged(updated);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`border-2 border-dashed rounded-lg p-5 text-center transition-all cursor-pointer ${
          isDragActive
            ? "border-emerald-500 bg-emerald-950/20"
            : "border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-950"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInput}
          id="fileUploaderInput"
        />
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-slate-450" />
          <p className="text-xs font-semibold text-slate-300">
            Drag & drop files, or <span className="text-indigo-450 hover:underline">browse</span>
          </p>
          <p className="text-[10px] text-slate-500">
            Supports PDF, DOCX, XLSX, PNG, JPG (Max 25MB per file)
          </p>
        </div>
      </div>

      {progress !== null && (
        <div className="bg-[#0F1117] rounded-lg p-2.5 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-emerald-400 animate-pulse uppercase">Encrypting and uploading file...</span>
            <span className="text-[10px] font-mono text-slate-400">{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-350 h-full transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-[10px] font-semibold text-slate-400 font-mono uppercase tracking-wider">Secured Attachments ({files.length}):</p>
          <ul className="space-y-1.5">
            {files.map((file, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between text-xs font-mono bg-slate-950/60 p-2 rounded border border-slate-850/80 group"
              >
                <div className="flex items-center gap-2 text-slate-300 truncate max-w-[85%]">
                  <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">{file}</span>
                  <span className="text-[9px] text-emerald-500/80 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-500/10">AES SECURED</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition-colors"
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

// ChatBubble Component
export function ChatBubble({
  sender,
  text,
  timestamp,
  attachments = [],
}: {
  sender: string;
  text: string;
  timestamp: string;
  attachments?: string[];
  key?: string | number | React.Key;
}) {
  const isReporter = sender === "Reporter";

  return (
    <div className={`flex ${isReporter ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[75%] rounded-2xl p-3.5 text-xs shadow-md border ${
        isReporter 
          ? "bg-[#0B0C10] text-[#E2E8F0] border-slate-800 rounded-tr-none" 
          : "bg-indigo-600 text-white border-indigo-500/25 rounded-tl-none shadow-lg shadow-indigo-600/10"
      }`}>
        <div className="flex items-center justify-between gap-5 mb-1.5 border-b border-white/10 pb-1">
          <span className={`font-semibold ${isReporter ? "text-indigo-400" : "text-white"}`}>
            {isReporter ? "Anonymous Whistleblower" : sender}
          </span>
          <span className={`text-[9px] font-mono ${isReporter ? "text-slate-500" : "text-slate-300"}`}>{timestamp}</span>
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{text}</p>
        
        {attachments.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/40">
            <span className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">Secure Attachments:</span>
            <div className="space-y-1 mt-1">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 bg-slate-950 px-2 py-1 rounded border border-slate-850">
                  <FileText className="w-3 h-3 text-emerald-500" />
                  <span className="truncate">{file}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
