import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchCompanies } from "../store/slices/companySlice";
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
          <Link to="/companies/new">
            <Button>+ Add company</Button>
          </Link>
        }
      />

      {error && <AlertBanner level="error">{error}</AlertBanner>}

      {loading ? (
        <Loader label="Loading companies…" />
      ) : list.length === 0 ? (
        <EmptyState
          title="No companies yet"
          message="Add your first company to start recording waste data."
          action={
            <Link to="/companies/new">
              <Button>+ Add company</Button>
            </Link>
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
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
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
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/companies/${c._id}/edit`}
                        className="text-emerald-700 hover:underline font-medium"
                      >
                        Edit
                      </Link>
                    </td>
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
