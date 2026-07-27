package com.privacypilot.backend.security;

import java.util.Optional;

/**
 * Holds the id of the user handling the CURRENT request, so code that runs deep
 * inside a request (like MongoDB auditing) can learn "who is doing this" without the
 * caller passing it down by hand.
 *
 * HOW IT IS FILLED: {@link AuthenticatedUserArgumentResolver} sets the id the moment
 * it resolves the signed-in user from the RegulaOne session, at the very start of a
 * request. Spring Data then reads it here to stamp {@code createdBy} / {@code updatedBy}
 * on every saved record (see MongoAuditingConfig).
 *
 * WHY A ThreadLocal: a web request is handled on ONE thread from start to finish, so a
 * value stored here is visible to everything that thread does during the request — and
 * only that request. {@link CurrentUserContextFilter} CLEARS it when the request ends,
 * so a reused server thread never carries one user's id into the next user's request.
 */
public final class CurrentUserContext {

    // The current request's user id. Null when there is no request in progress
    // (for example a scheduled/background job), which is fine — see getUserId().
    private static final ThreadLocal<String> USER_ID = new ThreadLocal<>();

    private CurrentUserContext() {
        // Utility holder — never constructed.
    }

    /** Remember the signed-in user's id for the rest of THIS request. */
    public static void setUserId(String userId) {
        USER_ID.set(userId);
    }

    /** The current request's user id, or empty when there is no user in context. */
    public static Optional<String> getUserId() {
        return Optional.ofNullable(USER_ID.get());
    }

    /** Forget the id — MUST be called at the end of every request (see the filter). */
    public static void clear() {
        USER_ID.remove();
    }
}
