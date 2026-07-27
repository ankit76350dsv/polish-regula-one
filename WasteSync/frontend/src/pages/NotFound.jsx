import { Link } from "react-router-dom";
import { EmptyState, Button } from "../components/common";

// Shown when the URL does not match any page.
export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      message="The page you were looking for does not exist."
      action={
        <Link to="/">
          <Button>Back to dashboard</Button>
        </Link>
      }
    />
  );
}
