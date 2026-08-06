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
import { WASTE_CATEGORIES } from "../utils/constants";
import { useCapabilities } from "../hooks/useCapabilities";
import { useTranslation } from "../hooks/useTranslation";

export default function ReportDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { selected } = useSelector((state) => state.reports);
  const [downloadError, setDownloadError] = useState("");

  // Words, month names, category names, numbers and dates for the chosen language.
  const { t, monthNames, categoryLabel, formatNumber, formatDateTime } = useTranslation();

  // Two different permissions are needed on this page:
  //   - REPORT_EXPORT lets you download the XML/PDF. Auditors have it, because the
  //     file IS the evidence an audit needs and downloading changes nothing.
  //   - REPORT_SUBMIT lets you mark the report as filed in the government BDO
  //     register. ADMIN ONLY: that flag is the company's record of a legal filing,
  //     so HR prepares and downloads the report and an admin confirms the filing.
  const { can, CAPABILITIES } = useCapabilities();
  const canExport = can(CAPABILITIES.REPORT_EXPORT);
  const canSubmit = can(CAPABILITIES.REPORT_SUBMIT);

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
      // If the server explained the problem we show ITS message, because it knows
      // more than we do. Our own wording is only the fallback, and that one is
      // translated.
      setDownloadError(
        err?.response?.data?.message ||
          t("reportDetail.downloadError", { format: format.toUpperCase() })
      );
    }
  };

  if (!selected || selected._id !== id) {
    return <Loader label={t("reportDetail.loading")} />;
  }

  const r = selected;
  // categoryTotals comes back as a plain object from the API.
  const totals = r.categoryTotals || {};

  return (
    <div>
      <PageHeader
        title={t("reportDetail.title", { year: r.year })}
        subtitle={t("reportDetail.subtitle", {
          company: r.companyName || "",
          bdo: r.bdoRegistrationNumber,
        })}
        actions={
          <div className="flex items-center gap-2">
            {canExport && (
              <>
                <Button variant="secondary" onClick={() => handleDownload("xml")}>
                  {t("reportDetail.downloadXml")}
                </Button>
                <Button variant="secondary" onClick={() => handleDownload("pdf")}>
                  {t("reportDetail.downloadPdf")}
                </Button>
              </>
            )}
            {/* Shown only to an admin, and only while the report has not been
                marked as filed yet. */}
            {canSubmit && r.status !== "SUBMITTED" && (
              <Button onClick={() => dispatch(submitReport(id))}>
                {t("reportDetail.markSubmitted")}
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge tone="blue">{t("reportDetail.version", { version: r.version })}</Badge>
        {r.status === "SUBMITTED" ? (
          <Badge tone="green">{t("reportDetail.submittedToBdo")}</Badge>
        ) : (
          <Badge tone="amber">{t("reportDetail.generated")}</Badge>
        )}
        {/* Three honest states, not two:
            - not evaluated : no legal limits were configured, so nothing was checked
            - passed        : checked against real limits and no legal maximum exceeded
            - breach        : a legal maximum was exceeded */}
        {!r.thresholdValidation?.evaluated ? (
          <Badge tone="amber">{t("reportDetail.thresholdsNotEvaluated")}</Badge>
        ) : r.thresholdValidation?.passed ? (
          <Badge tone="green">{t("reportDetail.thresholdsPassed")}</Badge>
        ) : (
          <Badge tone="red">{t("reportDetail.thresholdBreach")}</Badge>
        )}
      </div>

      {downloadError && (
        <div className="mb-4">
          <AlertBanner level="error">{downloadError}</AlertBanner>
        </div>
      )}

      {/* The report is ready but this person cannot confirm the filing. We say so
          plainly, so nobody thinks the report is finished — or waits for a button
          that is never going to appear for them. */}
      {!canSubmit && r.status !== "SUBMITTED" && (
        <div className="mb-4">
          <AlertBanner level="info">{t("reportDetail.notFiledNotice")}</AlertBanner>
        </div>
      )}

      {/* No legal limits were configured, so the check could not run. We say so
          plainly instead of hiding it behind a green "passed" badge. */}
      {!r.thresholdValidation?.evaluated && (
        <div className="mb-4">
          <AlertBanner level="info">
            {t("reportDetail.noThresholdsNotice", { year: r.year })}
          </AlertBanner>
        </div>
      )}

      {/* A real check ran and found one or more legal maximums exceeded. */}
      {r.thresholdValidation?.evaluated && !r.thresholdValidation?.passed && (
        <div className="mb-4">
          <AlertBanner level="warning">
            <div className="font-medium mb-1">{t("reportDetail.breachesTitle")}</div>
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
            {t("reportDetail.missingMonths", {
              months: r.missingMonths.map((m) => monthNames[m - 1]).join(", "),
            })}
          </AlertBanner>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category totals */}
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-700 mb-4">
            {t("reportDetail.totalsTitle")}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {WASTE_CATEGORIES.map((c) => (
                <tr key={c.key} className="border-b border-slate-100">
                  <td className="py-2 text-slate-600">{categoryLabel(c.key)}</td>
                  <td className="py-2 text-right font-medium">
                    {formatNumber(totals[c.key] ?? 0)} {t("common.kg")}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-semibold">{t("reportDetail.grandTotal")}</td>
                <td className="py-2 text-right font-bold text-emerald-700">
                  {formatNumber(r.grandTotalKg)} {t("common.kg")}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Meta */}
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-700 mb-4">
            {t("reportDetail.detailsTitle")}
          </div>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("reportDetail.reportingYear")}</dt>
              <dd className="font-medium">{r.year}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("reportDetail.bdoNumber")}</dt>
              <dd className="font-mono">{r.bdoRegistrationNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("reportDetail.generatedAt")}</dt>
              <dd>{formatDateTime(r.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("common.status")}</dt>
              {/* The raw status CODE, on purpose. This is the exact value stored
                  against the filing, and an inspector comparing this screen with the
                  record must see the same word — so it is never translated. The
                  friendly, translated version is the badge at the top of the page. */}
              <dd>{r.status}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <Link to="/reports" className="text-emerald-700 hover:underline text-sm font-medium">
              {t("reportDetail.backToReports")}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
