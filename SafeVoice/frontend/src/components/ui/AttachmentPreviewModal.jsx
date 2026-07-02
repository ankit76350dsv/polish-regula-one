import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Download } from "lucide-react";
import { AppModal } from "./AppModal";
import { AppButton } from "./AppButton";
import { Spinner } from "./Spinner";
import { saveBlob } from "../../utils/download";

// Map our allowed extensions to a real MIME type. The backend serves attachments as
// application/octet-stream, which would make the browser download rather than render them.
// Re-wrapping the blob with the correct type lets <img>/<iframe> preview it inline.
const MIME_BY_EXTENSION = {
  PDF: "application/pdf",
  PNG: "image/png",
  JPG: "image/jpeg",
  // SECURITY: XML is previewed as PLAIN TEXT, never application/xml. An evidence file is
  // untrusted; served as application/xml the browser could parse it as XHTML/HTML and run
  // embedded scripts. As text/plain it is shown verbatim (and the iframe is sandboxed too).
  XML: "text/plain",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const isImage = (ext) => ext === "PNG" || ext === "JPG";
const canRenderInline = (ext) => isImage(ext) || ext === "PDF" || ext === "XML";

/**
 * Previews ONE evidence attachment in a modal (image / PDF / XML inline; other types show a
 * "download to view" message), with a Download button in the footer.
 *
 * Props:
 *   open        bool
 *   attachment  { displayName, extension, sizeLabel } | null
 *   fetchBlob   async () => ({ blob, filename })  — fetches the bytes when the modal opens
 *   onClose     () => void
 */
export function AttachmentPreviewModal({ open, attachment, fetchBlob, onClose }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: false, url: null, blob: null, filename: "", error: "" });

  // Keep the latest fetchBlob in a ref so the load effect can depend only on open + file id
  // (fetchBlob is a fresh closure each render).
  const fetchRef = useRef(fetchBlob);
  useEffect(() => {
    fetchRef.current = fetchBlob;
  }, [fetchBlob]);

  const ext = attachment?.extension;

  useEffect(() => {
    if (!open || !attachment) return undefined;
    let cancelled = false;
    let objectUrl = null;
    setState({ loading: true, url: null, blob: null, filename: "", error: "" });

    (async () => {
      try {
        const { blob, filename } = await fetchRef.current();
        if (cancelled) return;
        // Re-wrap with the correct MIME type so the browser renders instead of downloading.
        const typed = MIME_BY_EXTENSION[ext] ? new Blob([blob], { type: MIME_BY_EXTENSION[ext] }) : blob;
        objectUrl = canRenderInline(ext) ? URL.createObjectURL(typed) : null;
        setState({ loading: false, url: objectUrl, blob: typed, filename, error: "" });
      } catch (err) {
        if (!cancelled) setState({ loading: false, url: null, blob: null, filename: "", error: err?.message || "error" });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attachment?.id]);

  const title = attachment?.displayName || t("evidence.file");

  return (
    <AppModal isOpen={open} onClose={onClose} title={title} maxWidth="max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="min-h-[16rem] flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
          {state.loading ? (
            <Spinner label={t("common.loading")} />
          ) : state.error ? (
            <div className="flex items-center gap-2 text-xs text-rose-700 p-4">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {state.error}
            </div>
          ) : state.url && isImage(ext) ? (
            <img src={state.url} alt={title} className="max-h-[70vh] max-w-full object-contain" />
          ) : state.url && (ext === "PDF" || ext === "XML") ? (
            // SECURITY: sandboxed WITHOUT allow-same-origin, so even if a malicious file runs
            // script, it executes in an opaque origin and cannot touch the app's session,
            // cookies, DOM or make credentialed same-origin requests. allow-scripts is kept only
            // so the browser's PDF viewer (e.g. Firefox pdf.js) works; combining it with
            // allow-same-origin would let the frame escape the sandbox, so we never do that.
            <iframe
              src={state.url}
              title={title}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              className="w-full h-[70vh] bg-white"
            />
          ) : (
            <p className="text-xs text-slate-500 p-6 text-center">{t("evidence.noPreview")}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-mono text-slate-500">
            {[ext, attachment?.sizeLabel].filter(Boolean).join(" · ")}
          </span>
          <AppButton
            type="button"
            variant="primary"
            icon={<Download className="w-4 h-4" />}
            disabled={!state.blob}
            onClick={() => state.blob && saveBlob(state.blob, state.filename || title)}
          >
            {t("evidence.download")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}
