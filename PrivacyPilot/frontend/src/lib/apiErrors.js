// Turning a failed request into something a person can act on.
//
// WHY THIS EXISTS: pages used to map EVERY failure to "Your role does not permit this
// action". So a dropped connection or a server error told the user they lacked permission,
// sending them to their administrator about a problem that had nothing to do with access.
// A wrong explanation is worse than a vague one — it makes people chase the wrong fix.
//
// The server always answers with a machine code in the AppResponse envelope (see the
// backend's GlobalExceptionHandler), which the HTTP client puts on `error.message`.

/**
 * @param {{message?: string}} error the rejected thunk's error
 * @param {(key: string) => string} t the translator
 * @param {string} [conflictMessage] what to say for a 409 CONFLICT — always page-specific
 *        ("this processor is still linked to…"), so the caller supplies it
 * @returns {string} a message to show the user
 */
export function failureMessage(error, t, conflictMessage) {
  switch (error?.message) {
    case 'FORBIDDEN':
      return t('common.notAuthorized');
    case 'UNAUTHENTICATED':
      return t('auth.errorTitle');
    case 'CONFLICT':
      return conflictMessage ?? t('common.saveFailed');
    case 'VALIDATION_ERROR':
    case 'BAD_REQUEST':
      // The server's own field message is the most useful thing here, and it is written
      // for a person ("name is required"), not a stack trace.
      return error.serverMessage || t('common.saveFailed');
    default:
      return t('common.saveFailed');
  }
}
