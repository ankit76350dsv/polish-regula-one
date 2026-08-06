import { Link } from "react-router-dom";
import { EmptyState, Button } from "../components/common";
import { useTranslation } from "../hooks/useTranslation";

// Shown when the URL does not match any page.
export default function NotFound() {
  const { t } = useTranslation();

  return (
    <EmptyState
      title={t("notFound.title")}
      message={t("notFound.message")}
      action={
        <Link to="/">
          <Button>{t("notFound.back")}</Button>
        </Link>
      }
    />
  );
}
