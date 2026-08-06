package com.regulaone.backend.common;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The rate limiter guards the endpoints anyone on the internet can reach, so its
 * behaviour is worth pinning down rather than assuming.
 */
class RateLimitFilterTest {

    private static final int LIMIT = 3;

    private RateLimitFilter filterAllowing(int max, int windowSeconds) {
        RateLimitFilter filter = new RateLimitFilter();
        ReflectionTestUtils.setField(filter, "enabled", true);
        ReflectionTestUtils.setField(filter, "maxRequests", max);
        ReflectionTestUtils.setField(filter, "windowSeconds", windowSeconds);
        return filter;
    }

    private MockHttpServletRequest loginFrom(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/sso/login");
        request.setRemoteAddr(ip);
        return request;
    }

    /** A caller within the allowance is passed straight through. */
    @Test
    void allowsRequestsUpToTheLimit() throws Exception {
        RateLimitFilter filter = filterAllowing(LIMIT, 60);

        for (int attempt = 1; attempt <= LIMIT; attempt++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            boolean[] reachedTheApplication = {false};
            FilterChain chain = (req, res) -> reachedTheApplication[0] = true;

            filter.doFilter(loginFrom("10.0.0.1"), response, chain);

            assertTrue(reachedTheApplication[0], "attempt " + attempt + " should have passed");
            assertEquals(200, response.getStatus());
        }
    }

    /** Past the allowance: 429, a Retry-After header, and the request never runs. */
    @Test
    void blocksOnceTheLimitIsPassed() throws Exception {
        RateLimitFilter filter = filterAllowing(LIMIT, 60);
        FilterChain doNothing = (req, res) -> { };

        for (int i = 0; i < LIMIT; i++) {
            filter.doFilter(loginFrom("10.0.0.2"), new MockHttpServletResponse(), doNothing);
        }

        MockHttpServletResponse blocked = new MockHttpServletResponse();
        boolean[] reachedTheApplication = {false};
        filter.doFilter(loginFrom("10.0.0.2"), blocked, (req, res) -> reachedTheApplication[0] = true);

        assertFalse(reachedTheApplication[0], "the blocked request must not reach the application");
        assertEquals(429, blocked.getStatus());
        assertEquals("60", blocked.getHeader("Retry-After"));
        assertTrue(blocked.getContentAsString().contains("RATE_LIMITED"));
        // It must not hint at whether the account exists.
        assertFalse(blocked.getContentAsString().toLowerCase().contains("password"));
    }

    /** One caller's flood must not lock out everybody else. */
    @Test
    void countsEachCallerSeparately() throws Exception {
        RateLimitFilter filter = filterAllowing(LIMIT, 60);
        FilterChain doNothing = (req, res) -> { };

        for (int i = 0; i <= LIMIT; i++) {
            filter.doFilter(loginFrom("10.0.0.3"), new MockHttpServletResponse(), doNothing);
        }

        MockHttpServletResponse other = new MockHttpServletResponse();
        boolean[] reachedTheApplication = {false};
        filter.doFilter(loginFrom("10.0.0.4"), other, (req, res) -> reachedTheApplication[0] = true);

        assertTrue(reachedTheApplication[0], "a different caller must be unaffected");
        assertEquals(200, other.getStatus());
    }

    /** The proxy header decides the caller, so one shared proxy IP is not one bucket. */
    @Test
    void usesTheForwardedAddressBehindAProxy() throws Exception {
        RateLimitFilter filter = filterAllowing(LIMIT, 60);
        FilterChain doNothing = (req, res) -> { };

        for (int i = 0; i <= LIMIT; i++) {
            MockHttpServletRequest flooding = loginFrom("172.16.0.1");   // the load balancer
            flooding.addHeader("X-Forwarded-For", "203.0.113.9, 172.16.0.1");
            filter.doFilter(flooding, new MockHttpServletResponse(), doNothing);
        }

        MockHttpServletRequest innocent = loginFrom("172.16.0.1");       // same proxy…
        innocent.addHeader("X-Forwarded-For", "203.0.113.50, 172.16.0.1"); // …different person
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] reachedTheApplication = {false};

        filter.doFilter(innocent, response, (req, res) -> reachedTheApplication[0] = true);

        assertTrue(reachedTheApplication[0], "a second person behind the same proxy must get through");
    }

    /** Endpoints that are not credential-checking are left alone. */
    @Test
    void ignoresEndpointsItDoesNotGuard() throws Exception {
        RateLimitFilter filter = filterAllowing(1, 60);
        FilterChain doNothing = (req, res) -> { };

        MockHttpServletRequest internal =
                new MockHttpServletRequest("POST", "/api/internal/notifications/events");
        internal.setRemoteAddr("10.0.0.5");
        for (int i = 0; i < 5; i++) {
            filter.doFilter(internal, new MockHttpServletResponse(), doNothing);
        }

        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] reachedTheApplication = {false};
        filter.doFilter(internal, response, (req, res) -> reachedTheApplication[0] = true);

        assertTrue(reachedTheApplication[0], "module traffic must never be throttled");
    }

    /** A GET carries no credentials, so it is not counted. */
    @Test
    void onlyCountsPosts() throws Exception {
        RateLimitFilter filter = filterAllowing(1, 60);
        FilterChain doNothing = (req, res) -> { };

        MockHttpServletRequest get = new MockHttpServletRequest("GET", "/api/sso/login");
        get.setRemoteAddr("10.0.0.6");
        for (int i = 0; i < 5; i++) {
            filter.doFilter(get, new MockHttpServletResponse(), doNothing);
        }

        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] reachedTheApplication = {false};
        filter.doFilter(get, response, (req, res) -> reachedTheApplication[0] = true);

        assertTrue(reachedTheApplication[0]);
    }

    /** The window resets, so a locked-out caller is not locked out for ever. */
    @Test
    void allowsAgainAfterTheWindowPasses() throws Exception {
        RateLimitFilter filter = filterAllowing(1, 1);   // one request per second
        FilterChain doNothing = (req, res) -> { };

        filter.doFilter(loginFrom("10.0.0.7"), new MockHttpServletResponse(), doNothing);
        filter.doFilter(loginFrom("10.0.0.7"), new MockHttpServletResponse(), doNothing);

        Thread.sleep(1100);

        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] reachedTheApplication = {false};
        filter.doFilter(loginFrom("10.0.0.7"), response, (req, res) -> reachedTheApplication[0] = true);

        assertTrue(reachedTheApplication[0], "the caller should be allowed again in the next window");
    }
}
