// Privacy notices — generation gated by the Art. 13/14 completeness checklist.
import { apiGet, apiMutate, newId } from './api';
import { ACTIONS } from '../lib/permissions';
import { buildChecklist, buildNoticeContent } from '../lib/noticeBuilder';

export const noticeService = {
  list: () => apiGet((db) => db.notices),

  /** Checklist preview (no mutation) — the page shows this before generating. */
  checklist: (audienceId) =>
    apiGet((db) =>
      buildChecklist({ settings: db.settings, activities: db.activities, audienceId }),
    ),

  generate: (actor, { audienceId, language }) =>
    apiMutate({
      actor,
      action: ACTIONS.GENERATE_NOTICES,
      audit: (notice) => ({
        action: 'GENERATE', entityType: 'notice', entityId: notice.id,
        entityLabel: notice.title, oldValue: null,
        newValue: { audience: notice.audience, version: notice.version },
      }),
      mutator: (db) => {
        const { blocked, checklist } = buildChecklist({
          settings: db.settings, activities: db.activities, audienceId,
        });
        if (blocked) {
          const err = new Error('CHECKLIST_INCOMPLETE');
          err.code = 'CHECKLIST_INCOMPLETE';
          err.missing = checklist.filter((c) => !c.ok);
          throw err;
        }
        const content = buildNoticeContent({
          settings: db.settings,
          activities: db.activities,
          transfers: db.transfers,
          vendors: db.vendors,
          audienceId,
          language,
        });
        const version =
          Math.max(0, ...db.notices.filter((n) => n.audience === audienceId).map((n) => n.version)) + 1;
        const notice = {
          id: newId('not'),
          audience: audienceId,
          language,
          version,
          title: content.split('\n')[0].replace(/^#\s*/, ''),
          content,
          generatedAt: new Date().toISOString(),
          generatedBy: actor.name,
        };
        db.notices.unshift(notice);
        return notice;
      },
    }),
};
