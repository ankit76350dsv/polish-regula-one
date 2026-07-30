package com.privacypilot.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests the flood protection on the API.
 *
 * There was previously NO limit on any endpoint, so a script could hammer the register or
 * the audit trail — and, because every request triggers a login lookup against RegulaOne,
 * flooding this service also flooded the platform's login service.
 *
 * Plain JUnit with Spring's mock servlet objects: no Spring context, no network, no clock
 * dependency beyond the filter's own.
 */
class RateLimitFilterTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** A filter with tiny, easy-to-exhaust allowances: 2 reads and 1 write, refilling slowly. */
    private static RateLimitFilter filter() {
        return new RateLimitFilter(JSON, true, 2, 6, 1, 6);
    }

    private static MockHttpServletRequest request(String method, String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRemoteAddr("10.0.0.1");
        return request;
    }

    /** Send one request through the filter and report whether it reached the controller. */
    private static boolean passes(RateLimitFilter filter, MockHttpServletRequest request)
            throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        return response.getStatus() != HttpStatus.TOO_MANY_REQUESTS.value();
    }

    private static MockHttpServletResponse send(RateLimitFilter filter,
                                                MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    @DisplayName("lets normal traffic through — a full bucket means no surprise for real users")
    void allowsTrafficWithinTheAllowance() throws Exception {
        RateLimitFilter filter = filter();
        assertTrue(passes(filter, request("GET", "/api/privacypilot/activities")));
        assertTrue(passes(filter, request("GET", "/api/privacypilot/activities")));
    }

    @Test
    @DisplayName("refuses with 429 once the read allowance is spent")
    void refusesOnceExhausted() throws Exception {
        RateLimitFilter filter = filter();
        passes(filter, request("GET", "/api/privacypilot/audit"));
        passes(filter, request("GET", "/api/privacypilot/audit"));

        MockHttpServletResponse blocked = send(filter, request("GET", "/api/privacypilot/audit"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS.value(), blocked.getStatus());
    }

    @Test
    @DisplayName("a refusal says how long to wait and uses the standard error envelope")
    void refusalIsWellFormed() throws Exception {
        RateLimitFilter filter = filter();
        passes(filter, request("GET", "/api/privacypilot/audit"));
        passes(filter, request("GET", "/api/privacypilot/audit"));

        MockHttpServletResponse blocked = send(filter, request("GET", "/api/privacypilot/audit"));

        // A well-behaved client is told exactly when to come back.
        String retryAfter = blocked.getHeader(HttpHeaders.RETRY_AFTER);
        assertNotNull(retryAfter, "Retry-After must be set");
        assertTrue(Integer.parseInt(retryAfter) >= 1);

        // Same shape as every other failure, so the frontend needs no special case.
        assertTrue(blocked.getContentType().contains("application/json"));
        var body = JSON.readTree(blocked.getContentAsString());
        assertEquals(false, body.get("success").asBoolean());
        assertEquals("RATE_LIMITED", body.get("errorCode").asString());
        assertEquals(429, body.get("status").asInt());
    }

    @Nested
    @DisplayName("reads and writes have separate allowances")
    class SeparateBuckets {

        @Test
        @DisplayName("a heavy reader cannot use up the write allowance")
        void readsDoNotStarveWrites() throws Exception {
            RateLimitFilter filter = filter();
            // Spend the whole read allowance and then some.
            passes(filter, request("GET", "/api/privacypilot/activities"));
            passes(filter, request("GET", "/api/privacypilot/activities"));
            passes(filter, request("GET", "/api/privacypilot/activities"));

            // The write allowance is untouched, so the write still gets through.
            assertTrue(passes(filter, request("POST", "/api/privacypilot/activities")));
        }

        @Test
        @DisplayName("writes are held to their own, tighter allowance")
        void writesAreStricter() throws Exception {
            RateLimitFilter filter = filter();
            assertTrue(passes(filter, request("POST", "/api/privacypilot/activities")));
            // Only one write was allowed, so the second is refused …
            assertEquals(HttpStatus.TOO_MANY_REQUESTS.value(),
                    send(filter, request("POST", "/api/privacypilot/activities")).getStatus());
            // … while reading still works.
            assertTrue(passes(filter, request("GET", "/api/privacypilot/activities")));
        }

        @Test
        @DisplayName("every write verb counts against the write allowance")
        void allWriteVerbsCount() throws Exception {
            for (String method : new String[] {"POST", "PUT", "PATCH", "DELETE"}) {
                RateLimitFilter filter = filter();
                assertTrue(passes(filter, request(method, "/api/privacypilot/vendors/v1")),
                        method + " should be allowed first");
                assertEquals(HttpStatus.TOO_MANY_REQUESTS.value(),
                        send(filter, request(method, "/api/privacypilot/vendors/v1")).getStatus(),
                        method + " should be refused once the write allowance is spent");
            }
        }
    }

    @Nested
    @DisplayName("callers are counted separately")
    class CallerIsolation {

        @Test
        @DisplayName("one address flooding does not block a different address")
        void differentAddressesHaveOwnAllowance() throws Exception {
            RateLimitFilter filter = filter();
            MockHttpServletRequest flooder = request("GET", "/api/privacypilot/audit");
            passes(filter, flooder);
            passes(filter, flooder);
            assertEquals(HttpStatus.TOO_MANY_REQUESTS.value(), send(filter, flooder).getStatus());

            MockHttpServletRequest other = request("GET", "/api/privacypilot/audit");
            other.setRemoteAddr("10.0.0.99");
            assertTrue(passes(filter, other), "a different caller must not be punished");
        }

        @Test
        @DisplayName("a signed-in session gets its own allowance, separate from the address")
        void sessionIsTrackedSeparatelyFromAddress() throws Exception {
            RateLimitFilter filter = filter();
            // Same address, but this caller carries a session cookie.
            MockHttpServletRequest signedIn = request("GET", "/api/privacypilot/audit");
            signedIn.setCookies(new Cookie("idToken", "token-aaa"));
            passes(filter, signedIn);
            passes(filter, signedIn);
            assertEquals(HttpStatus.TOO_MANY_REQUESTS.value(), send(filter, signedIn).getStatus());

            // A DIFFERENT session from the same address is unaffected.
            MockHttpServletRequest otherSession = request("GET", "/api/privacypilot/audit");
            otherSession.setCookies(new Cookie("idToken", "token-bbb"));
            assertTrue(passes(filter, otherSession));
        }
    }

    @Nested
    @DisplayName("what is deliberately not limited")
    class Exemptions {

        @Test
        @DisplayName("CORS pre-flight is never refused — it carries no data")
        void preflightIsExempt() throws Exception {
            RateLimitFilter filter = filter();
            // Far more than any allowance; every one must pass, or the browser would show a
            // confusing CORS error instead of an honest 429 on the real request.
            for (int i = 0; i < 20; i++) {
                assertTrue(passes(filter, request("OPTIONS", "/api/privacypilot/activities")));
            }
        }

        @Test
        @DisplayName("non-API paths are not limited")
        void nonApiPathsAreExempt() throws Exception {
            RateLimitFilter filter = filter();
            for (int i = 0; i < 20; i++) {
                assertTrue(passes(filter, request("GET", "/favicon.ico")));
            }
        }

        @Test
        @DisplayName("the limiter can be switched off entirely by configuration")
        void canBeDisabled() throws Exception {
            RateLimitFilter disabled = new RateLimitFilter(JSON, false, 1, 1, 1, 1);
            for (int i = 0; i < 20; i++) {
                assertTrue(passes(disabled, request("POST", "/api/privacypilot/activities")));
            }
        }
    }

    @Test
    @DisplayName("the allowance refills over time, so a blocked caller recovers")
    void allowanceRefills() throws Exception {
        // 60 tokens per minute = 1 per second, capacity 1: after being refused, roughly a
        // second of waiting must make the next request possible again.
        RateLimitFilter filter = new RateLimitFilter(JSON, true, 1, 60, 1, 60);
        MockHttpServletRequest req = request("GET", "/api/privacypilot/audit");

        assertTrue(passes(filter, req));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS.value(), send(filter, req).getStatus());

        Thread.sleep(1_100);
        assertTrue(passes(filter, req), "the allowance should have refilled after a second");
    }
}
