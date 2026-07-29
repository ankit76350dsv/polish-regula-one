# Data Retention, Deletion & Legal Hold

Retention follows two principles together: keep records as long as the whistleblower law
requires, and **no longer than necessary** under GDPR storage limitation (Art. 5(1)(e)).

## Retention periods

| Data | Poland | Source |
|---|---|---|
| Report register & related personal data (entity) | **3 years** after end of calendar year follow-up ended | Polish Act Art. 8(8) |
| RPO-transmitted reports | 12 months after end of calendar year of transmittal | Polish Act Art. 8(7) |
| Irrelevant personal data | Not collected, or deleted **within 14 days** of finding it irrelevant | Polish Act Art. 8(4) |

> RegulaOne's CLAUDE.md sets a 10-year default for invoices/audit logs in *other* modules.
> For **whistleblower** reports the specific 3-year rule of the Whistleblower Act governs —
> do not blanket-apply the 10-year retention to SafeVoice report data.

## Lifecycle states (modelled in the UI)

`RetentionState` in [`../../frontend/src/types.ts`](../../frontend/src/types.ts):
`Active → Deletion Scheduled → Destroyed`, with `Legal Hold` able to pause deletion.

- **Active** — within the retention period.
- **Deletion Scheduled** — case closed; deletion queued for the retention date.
- **Legal Hold** — deletion paused. Requires documented **reason, approver, timestamp, and
  periodic review** (modelled in the case detail "Retention and legal hold" panel).
- **Destroyed** — securely deleted.

## Secure destruction (production requirement)
When deleting, remove **all** copies: database rows, KMS data keys (crypto-shredding),
object-store versions, quarantined upload copies, backups per policy, and search indexes /
caches. Record a deletion certificate in the audit log (without reintroducing reporter data).

## Irrelevant-data timer
On intake, a 14-day timer (Poland) starts for any personal data found not relevant to the
report. The UI surfaces `irrelevantPersonalDataDeletionDue`; production must enforce the
actual deletion job.

---

_Last reviewed: 2026-06-18._
