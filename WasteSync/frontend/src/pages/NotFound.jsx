import { Link } from "react-router-dom";
import { EmptyState, Button } from "../components/common";
import { useTranslation } from "../hooks/useTranslation";
import { useOrgHome } from "../utils/paths";

// Shown when the URL does not match any page.
export default function NotFound() {
  const { t } = useTranslation();

  // "Back" must return to the home page INSIDE the user's company
  // ("/company/{tenantId}/home"), not to the bare app root.
  const orgHome = useOrgHome();

  return (
    <EmptyState
      title={t("notFound.title")}
      message={t("notFound.message")}
      action={
        <Link to={orgHome}>
          <Button>{t("notFound.back")}</Button>
        </Link>
      }
    />
  );
}
