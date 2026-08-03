import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchCompanies } from "../store/slices/companySlice";
import { useCapabilities } from "../hooks/useCapabilities";
import {
  PageHeader,
  Card,
  Button,
  Loader,
  AlertBanner,
  EmptyState,
  Badge,
} from "../components/common";

// Lists all of the tenant's companies and links to add / edit them.
export default function Companies() {
  const dispatch = useDispatch();
  const { list, loading, error } = useSelector((state) => state.companies);

  // May this person change company records? An auditor may only look, so for them
  // we hide "Add company" and the per-row "Edit" link. The backend refuses those
  // calls anyway — hiding the buttons just avoids offering something that fails.
  const { can, CAPABILITIES } = useCapabilities();
  const canWrite = can(CAPABILITIES.COMPANY_WRITE);

  // Load the companies once when the page opens.
  useEffect(() => {
    dispatch(fetchCompanies());
  }, [dispatch]);

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="The legal entities you report packaging waste for. Each has its own 9-digit BDO number."
        actions={
          canWrite ? (
            <Link to="/companies/new">
              <Button>+ Add company</Button>
            </Link>
          ) : null
        }
      />

      {error && <AlertBanner level="error">{error}</AlertBanner>}

      {loading ? (
        <Loader label="Loading companies…" />
      ) : list.length === 0 ? (
        <EmptyState
          title="No companies yet"
          message={
            canWrite
              ? "Add your first company to start recording waste data."
              : "No companies have been set up yet. Someone who manages company records needs to add one before there is anything to see here."
          }
          action={
            canWrite ? (
              <Link to="/companies/new">
                <Button>+ Add company</Button>
              </Link>
            ) : null
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">BDO number</th>
                  <th className="px-4 py-3 font-medium">NIP</th>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {/* The Actions column only exists for people who can edit, so a
                      read-only user does not see an empty column. */}
                  {canWrite && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 font-mono">{c.bdoRegistrationNumber}</td>
                    <td className="px-4 py-3">{c.nip || "—"}</td>
                    <td className="px-4 py-3">{c.address?.city || "—"}</td>
                    <td className="px-4 py-3">
                      {c.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/companies/${c._id}/edit`}
                          className="text-emerald-700 hover:underline font-medium"
                        >
                          Edit
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
