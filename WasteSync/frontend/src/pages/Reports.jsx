import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchCompanies, setActiveCompany } from "../store/slices/companySlice";
import { fetchReports, generateReport, clearGenerateError } from "../store/slices/reportSlice";
import {
  PageHeader,
  Card,
  Button,
  Loader,
  AlertBanner,
  Badge,
  EmptyState,
} from "../components/common";
import { CompanySelector, YearSelector } from "../components/common/Selectors";

export default function Reports() {
  const dispatch = useDispatch();
  const { list: companies, activeCompanyId } = useSelector((state) => state.companies);
  const { list, loading, generating, generateError } = useSelector((state) => state.reports);

  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    dispatch(fetchCompanies());
    dispatch(fetchReports());
  }, [dispatch]);

  // Generate a report for the chosen company + year, then refresh the list.
  const onGenerate = async () => {
    dispatch(clearGenerateError());
    const result = await dispatch(generateReport({ companyId: activeCompanyId, year }));
    if (generateReport.fulfilled.match(result)) {
      dispatch(fetchReports());
    }
  };

  return (
    <div>
      <PageHeader
        title="Annual Reports"
        subtitle="Generate BDO annual reports (XML for the portal + PDF for your records)."
        actions={
          <div className="flex items-center gap-3">
            <CompanySelector
              companies={companies}
              value={activeCompanyId}
              onChange={(id) => dispatch(setActiveCompany(id))}
            />
            <YearSelector value={year} onChange={setYear} />
            <Button onClick={onGenerate} disabled={generating || !activeCompanyId}>
              {generating ? "Generating…" : "Generate report"}
            </Button>
          </div>
        }
      />

      {generateError && (
        <div className="mb-4">
          <AlertBanner level="error">{generateError}</AlertBanner>
        </div>
      )}

      {loading ? (
        <Loader label="Loading reports…" />
      ) : list.length === 0 ? (
        <EmptyState
          title="No reports yet"
          message="Choose a company and year above, then generate your first annual report."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Year</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">BDO number</th>
                  <th className="px-4 py-3 font-medium text-right">Total (kg)</th>
                  <th className="px-4 py-3 font-medium">Compliance</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Version</th>
                  <th className="px-4 py-3 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold">{r.year}</td>
                    <td className="px-4 py-3">{r.companyName || r.companyId?.name || "—"}</td>
                    <td className="px-4 py-3 font-mono">{r.bdoRegistrationNumber}</td>
                    <td className="px-4 py-3 text-right">{r.grandTotalKg}</td>
                    <td className="px-4 py-3">
                      {r.thresholdValidation?.passed ? (
                        <Badge tone="green">Passed</Badge>
                      ) : (
                        <Badge tone="red">Breach</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "SUBMITTED" ? (
                        <Badge tone="green">Submitted</Badge>
                      ) : (
                        <Badge tone="amber">Generated</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone="blue">v{r.version}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/reports/${r._id}`}
                        className="text-emerald-700 hover:underline font-medium"
                      >
                        Open
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
