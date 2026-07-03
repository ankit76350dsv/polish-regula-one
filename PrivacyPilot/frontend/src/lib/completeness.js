// Register completeness — a factual checklist score, NOT a "compliance grade".
// Counts the Art. 30 fields actually filled on an activity; the dashboard
// shows the average so gaps are visible, without pretending to certify anything.

export function activityCompleteness(a) {
  const checks = [
    Boolean(a.name),
    Boolean(a.purpose),
    a.role === 'processor' ? Boolean(a.controllersServed) : Boolean(a.lawfulBasis),
    (a.dataSubjects?.length ?? 0) > 0,
    (a.dataCategories?.length ?? 0) > 0,
    (a.recipients?.length ?? 0) > 0 || (a.vendorIds?.length ?? 0) > 0,
    Boolean(a.retentionPeriod),
    (a.toms?.length ?? 0) > 0,
    // Transfers: complete when either none declared, or declared AND documented.
    !a.transfer || (a.transferIds?.length ?? 0) > 0,
    // Special categories need their Art. 9(2) condition.
    !a.dataCategories?.some((c) => ['health', 'biometric_id', 'genetic', 'trade_union'].includes(c)) ||
      Boolean(a.art9Condition),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
