/**
 * ConfirmDialog — a reusable "are you sure?" dialog for important / irreversible
 * actions (changing case status, exporting data, removing access). Built on the
 * accessible AppModal (focus trap, Esc, focus restore), so confirmation dialogs
 * everywhere behave and read the same way.
 */
import { useTranslation } from "react-i18next";
import { AppModal } from "./AppModal";
import { AppButton } from "../controls/AppButton";
import { Spinner } from "../feedback/Spinner";

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "primary", // "primary" | "danger" | "secure"
  loading = false,
  confirmDisabled = false, // block confirm until the dialog's own input is valid
  onConfirm,
  onCancel,
  children, // optional extra content (e.g. an input) shown between the message and buttons
}) {
  const { t } = useTranslation();

  return (
    <AppModal isOpen={isOpen} onClose={loading ? () => {} : onCancel} title={title} maxWidth="max-w-md">
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        {children}
        <div className="flex justify-end gap-2">
          <AppButton type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel || t("common.cancel")}
          </AppButton>
          <AppButton type="button" variant={tone} onClick={onConfirm} disabled={loading || confirmDisabled}>
            {loading ? <Spinner size={16} /> : confirmLabel || t("common.confirm")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}
