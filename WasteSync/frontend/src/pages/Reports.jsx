import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
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
import { YearSelector } from "../components/common/Selectors";
import { defaultReportingYear } from "../utils/constants";
import { useCapabilities } from "../hooks/useCapabilities";

export default function Reports() {
  const dispatch = useDispatch();
  const { list, loading, generating, generateError } = useSelector((state) => state.reports);

  // Opens on the year that is actually due, not simply "this year". The annual
  // report covers the PREVIOUS calendar year and is due 15 March.
  const [year, setYear] = useState(defaultReportingYear);

  // Building a report creates new records and new files, so it is a write. An
  // auditor may read every report but not produce one — otherwise the person
  // checking the figures would also be the person producing them.
  const { can, CAPABILITIES } = useCapabilities();
  const canGenerate = can(CAPABILITIES.REPORT_GENERATE);

  useEffect(() => {
    dispatch(fetchReports());
  }, [dispatch]);

  // Generate a report for the chosen year, then refresh the list. The company
  // comes from RegulaOne on the server, so there is nothing to pick here.
  const onGenerate = async () => {
    dispatch(clearGenerateError());
    const result = await dispatch(generateReport({ year }));
    if (generateReport.fulfilled.match(result)) {
      dispatch(fetchReports());
    }
  };

  return (
    <div>
      <PageHeader
        title="Annual Reports"
        subtitle={
          canGenerate
            ? "Generate BDO annual reports (XML for the portal + PDF for your records)."
            : "BDO annual reports. Open one to see its figures and download the XML or PDF."
        }
        actions={
          <div className="flex items-center gap-3">
            {/* The year picker stays for everyone: a read-only user still needs it
                to choose which report to look for. Only "Generate" is hidden. */}
            <YearSelector value={year} onChange={setYear} />
            {canGenerate && (
              <Button onClick={onGenerate} disabled={generating}>
                {generating ? "Generating…" : "Generate report"}
              </Button>
            )}
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
          message={
            canGenerate
              ? "Choose a year above, then generate your first annual report."
              : "No annual reports have been generated yet, so there is nothing to review here."
          }
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
                    {/* The snapshot taken when the report was filed — not
                        today's company details. That is what an audit needs. */}
                    <td className="px-4 py-3">{r.companyName || "—"}</td>
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
