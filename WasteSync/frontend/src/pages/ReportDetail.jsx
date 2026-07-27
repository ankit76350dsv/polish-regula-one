import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchReport, submitReport } from "../store/slices/reportSlice";
import { getDownloadUrl } from "../api/reportApi";
import {
  PageHeader,
  Card,
  Button,
  Loader,
  AlertBanner,
  Badge,
} from "../components/common";
import { WASTE_CATEGORIES, MONTH_NAMES } from "../utils/constants";

export default function ReportDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { selected } = useSelector((state) => state.reports);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    dispatch(fetchReport(id));
  }, [dispatch, id]);

  // Ask the backend for a short-lived presigned link, then open it in a new tab.
  const handleDownload = async (format) => {
    setDownloadError("");
    try {
      const { url } = await getDownloadUrl(id, format);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setDownloadError(
        err?.response?.data?.message || `Could not get the ${format.toUpperCase()} download link`
      );
    }
  };

  if (!selected || selected._id !== id) {
    return <Loader label="Loading report…" />;
  }

  const r = selected;
  // categoryTotals comes back as a plain object from the API.
  const totals = r.categoryTotals || {};

  return (
    <div>
      <PageHeader
        title={`Annual Report — ${r.year}`}
        subtitle={`${r.companyName || ""} · BDO ${r.bdoRegistrationNumber}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => handleDownload("xml")}>
              Download XML
            </Button>
            <Button variant="secondary" onClick={() => handleDownload("pdf")}>
              Download PDF
            </Button>
            {r.status !== "SUBMITTED" && (
              <Button onClick={() => dispatch(submitReport(id))}>Mark submitted</Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge tone="blue">Version {r.version}</Badge>
        {r.status === "SUBMITTED" ? (
          <Badge tone="green">Submitted to BDO</Badge>
        ) : (
          <Badge tone="amber">Generated</Badge>
        )}
        {/* Three honest states, not two:
            - not evaluated : no legal limits were configured, so nothing was checked
            - passed        : checked against real limits and no legal maximum exceeded
            - breach        : a legal maximum was exceeded */}
        {!r.thresholdValidation?.evaluated ? (
          <Badge tone="amber">Thresholds not evaluated</Badge>
        ) : r.thresholdValidation?.passed ? (
          <Badge tone="green">Thresholds passed</Badge>
        ) : (
          <Badge tone="red">Threshold breach</Badge>
        )}
      </div>

      {downloadError && (
        <div className="mb-4">
          <AlertBanner level="error">{downloadError}</AlertBanner>
        </div>
      )}

      {/* No legal limits were configured, so the check could not run. We say so
          plainly instead of hiding it behind a green "passed" badge. */}
      {!r.thresholdValidation?.evaluated && (
        <div className="mb-4">
          <AlertBanner level="info">
            No legal thresholds are configured for {r.year}, so the totals were not
            checked against any limit. Set the limits on the Thresholds page to make
            this check meaningful.
          </AlertBanner>
        </div>
      )}

      {/* A real check ran and found one or more legal maximums exceeded. */}
      {r.thresholdValidation?.evaluated && !r.thresholdValidation?.passed && (
        <div className="mb-4">
          <AlertBanner level="warning">
            <div className="font-medium mb-1">Legal threshold issues:</div>
            <ul className="list-disc ml-5">
              {(r.thresholdValidation?.breaches || []).map((b, i) => (
                <li key={i}>{b.message}</li>
              ))}
            </ul>
          </AlertBanner>
        </div>
      )}

      {/* Missing months */}
      {r.missingMonths?.length > 0 && (
        <div className="mb-4">
          <AlertBanner level="info">
            No data was recorded for:{" "}
            {r.missingMonths.map((m) => MONTH_NAMES[m - 1]).join(", ")}.
          </AlertBanner>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category totals */}
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-700 mb-4">Yearly totals by category</div>
          <table className="w-full text-sm">
            <tbody>
              {WASTE_CATEGORIES.map((c) => (
                <tr key={c.key} className="border-b border-slate-100">
                  <td className="py-2 text-slate-600">{c.label}</td>
                  <td className="py-2 text-right font-medium">{totals[c.key] ?? 0} kg</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-semibold">Grand total</td>
                <td className="py-2 text-right font-bold text-emerald-700">{r.grandTotalKg} kg</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Meta */}
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-700 mb-4">Report details</div>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Reporting year</dt>
              <dd className="font-medium">{r.year}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">BDO number</dt>
              <dd className="font-mono">{r.bdoRegistrationNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Generated</dt>
              <dd>{new Date(r.createdAt).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Status</dt>
              <dd>{r.status}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <Link to="/reports" className="text-emerald-700 hover:underline text-sm font-medium">
              ← Back to reports
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
