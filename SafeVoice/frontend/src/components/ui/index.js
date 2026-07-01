// Barrel file for SafeVoice shared UI building blocks.
// These are small, reusable pieces (buttons, cards, badges, inputs, modal,
// table, timeline, file uploader, chat bubble) used to build the full pages.
// Importing from "../ui" keeps page files short and easy to read.
export { AppButton } from "./AppButton";
export { SecureCard } from "./SecureCard";
export { CaseStatusBadge } from "./CaseStatusBadge";
export { CaseSeverityBadge } from "./CaseSeverityBadge";
export { SecureTextField } from "./SecureTextField";
export { AppTable } from "./AppTable";
export { AppModal } from "./AppModal";
export { TimelineWidget } from "./TimelineWidget";
export { AttachmentUploader } from "./AttachmentUploader";
export { MessageComposerAttachments } from "./MessageComposerAttachments";
export { MessageAttachmentList } from "./MessageAttachmentList";
export { AttachmentPreviewModal } from "./AttachmentPreviewModal";
export { ChatBubble } from "./ChatBubble";

// Newer primitives that complete the production UX (loading/empty/error, toasts,
// confirmation, pagination, theme + language controls, accessible form fields).
export { Spinner, PageSpinner } from "./Spinner";
export { EmptyState, ErrorState } from "./StateViews";
export { ToastHost } from "./ToastHost";
export { ConfirmDialog } from "./ConfirmDialog";
export { Pagination } from "./Pagination";
export { ThemeToggle } from "./ThemeToggle";
export { LanguageSwitcher } from "./LanguageSwitcher";
export { TextInput, TextArea, SelectField, Checkbox } from "./FormField";
export { StatusBadge, SeverityBadge } from "./StatusBadges";
