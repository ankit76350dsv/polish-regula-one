import { useTranslation } from "react-i18next";
import { Eye, FileText } from "lucide-react";

/**
 * Renders the evidence files attached to ONE chat message, as a small list under the
 * message text. Each row shows the (anonymised) display name, type and size.
 *
 * Opening is optional: pass `onOpen(attachment)` to make each row a button that opens the
 * file in a preview modal (used where the viewer is allowed to pull the bytes — the reporter
 * for their own case, or staff with the Export permission). Without it, rows are shown but
 * not clickable (the viewer can see a file exists but not its contents).
 *
 * Props:
 *   attachments  {id, displayName, extension, sizeLabel}[]  — from the backend message
 *   onOpen       (attachment) => void | undefined
 *   dark         bool — style for a dark (staff, cyan) bubble vs a light (reporter) one
 */
export function MessageAttachmentList({ attachments, onOpen, dark = false }) {
  const { t } = useTranslation();
  if (!attachments || attachments.length === 0) return null;

  const base = dark
    ? "bg-white/10 border-white/20 text-white hover:bg-white/20"
    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";

  return (
    <ul className="mt-2 flex flex-col gap-1">
      {attachments.map((a) => {
        const label = a.displayName || a.fileName || t("evidence.file");
        const meta = [a.extension, a.sizeLabel].filter(Boolean).join(" · ");
        const Wrapper = onOpen ? "button" : "div";
        return (
          <li key={a.id}>
            <Wrapper
              {...(onOpen
                ? {
                    type: "button",
                    onClick: () => onOpen(a),
                    title: t("evidence.view"),
                    "aria-label": `${t("evidence.view")}: ${label}`,
                  }
                : {})}
              className={`flex items-center gap-2 w-full text-left rounded border px-2 py-1 text-[11px] font-mono transition-colors ${base} ${
                onOpen ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500" : ""
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate flex-1">{label}</span>
              {meta && <span className="opacity-70 shrink-0">{meta}</span>}
              {onOpen && <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
            </Wrapper>
          </li>
        );
      })}
    </ul>
  );
}
