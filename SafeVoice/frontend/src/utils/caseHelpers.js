import { ReportCategory } from "../types";

export const nowStamp = () =>
  new Date().toISOString().replace("T", " ").substring(0, 16);

export const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().replace("T", " ").substring(0, 16);
};

export const addMonths = (months) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().replace("T", " ").substring(0, 16);
};

export const retentionDate = (years) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return `${date.getFullYear()}-12-31`;
};

const randomPart = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(4);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    "",
  );
};

export const createCaseId = () => {
  const values = new Uint16Array(1);
  window.crypto.getRandomValues(values);
  return `SV-${new Date().getFullYear()}-${String((values[0] % 900) + 100).padStart(3, "0")}`;
};

export const createTrackingCode = () => `SV-${randomPart()}-${randomPart()}`;

export const severityFor = (category) => {
  if (
    [
      ReportCategory.Corruption,
      ReportCategory.Fraud,
      ReportCategory.PublicProcurement,
    ].includes(category)
  )
    return "Critical";
  if (
    [
      ReportCategory.DataProtection,
      ReportCategory.Cybersecurity,
      ReportCategory.AML,
    ].includes(category)
  )
    return "High";
  if (category === ReportCategory.LabourDispute) return "Medium";
  return "Medium";
};

export const mapCategoryToBackend = (category) => {
  switch (category) {
    case ReportCategory.Corruption:
      return "CORRUPTION";
    case ReportCategory.Fraud:
      return "FRAUD";
    case ReportCategory.PublicProcurement:
      return "PUBLIC_PROCUREMENT";
    case ReportCategory.AML:
      return "AML";
    case ReportCategory.ProductSafety:
      return "PRODUCT_SAFETY";
    case ReportCategory.Environmental:
      return "ENVIRONMENTAL";
    case ReportCategory.ConsumerProtection:
      return "CONSUMER_PROTECTION";
    case ReportCategory.DataProtection:
      return "DATA_PROTECTION";
    case ReportCategory.Cybersecurity:
      return "CYBERSECURITY";
    case ReportCategory.HealthSafety:
      return "HEALTH_SAFETY";
    case ReportCategory.Discrimination:
      return "DISCRIMINATION";
    case ReportCategory.Harassment:
      return "HARASSMENT";
    case ReportCategory.LabourDispute:
      return "LABOUR_DISPUTE";
    default:
      return "OTHER";
  }
};

export const mapDisclosureModeToBackend = (mode) => {
  switch (mode) {
    case "Anonymous":
      return "ANONYMOUS";
    case "Confidential Named":
      return "CONFIDENTIAL_NAMED";
    case "HR Handoff":
      return "HR_HANDOFF";
    default:
      return "ANONYMOUS";
  }
};
