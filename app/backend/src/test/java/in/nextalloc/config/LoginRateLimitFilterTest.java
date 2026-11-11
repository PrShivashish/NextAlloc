package in.nextalloc.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.PrintWriter;
import java.io.StringWriter;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.FilterChain;

class LoginRateLimitFilterTest {

    @Test
    @DisplayName("Default 8/min rate limit allows 8 attempts and blocks 9th with HTTP 429")
    void defaultRateLimitAllowsEightAttemptsAndBlocksNinth() throws Exception {
        AppProperties props = new AppProperties();
        assertEquals(8, props.getRateLimit().getLoginPerMinute(), "Default configuration must remain strictly 8 attempts/min");

        LoginRateLimitFilter filter = new LoginRateLimitFilter(props);
        FilterChain chain = mock(FilterChain.class);

        // 8 login attempts from the same IP should pass through
        for (int i = 1; i <= 8; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("10.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus());
        }
        verify(chain, times(8)).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());

        // 9th attempt within the 1-minute window must be blocked with 429
        MockHttpServletRequest request9 = new MockHttpServletRequest("POST", "/api/auth/login");
        request9.setRemoteAddr("10.0.0.1");
        MockHttpServletResponse response9 = new MockHttpServletResponse();

        filter.doFilterInternal(request9, response9, chain);
        assertEquals(429, response9.getStatus(), "9th request must be rejected with HTTP 429 Too Many Requests");
        assertTrue(response9.getContentAsString().contains("Too many sign-in attempts"), "Response must contain clear user feedback");
        verify(chain, times(8)).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()); // Chain not invoked for 9th
    }

    @Test
    @DisplayName("Non-login endpoints are completely exempt from login rate limits")
    void nonLoginEndpointsAreExempt() throws Exception {
        AppProperties props = new AppProperties();
        LoginRateLimitFilter filter = new LoginRateLimitFilter(props);
        FilterChain chain = mock(FilterChain.class);

        for (int i = 1; i <= 20; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/health");
            request.setRemoteAddr("10.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus());
        }
        verify(chain, times(20)).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Custom test configuration can override rate limit safely for testing")
    void customConfigOverridesRateLimitSafely() throws Exception {
        AppProperties props = new AppProperties();
        props.getRateLimit().setLoginPerMinute(20);
        LoginRateLimitFilter filter = new LoginRateLimitFilter(props);
        FilterChain chain = mock(FilterChain.class);

        for (int i = 1; i <= 20; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("10.0.0.2");
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus());
        }
        verify(chain, times(20)).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());

        // 21st attempt blocked
        MockHttpServletRequest request21 = new MockHttpServletRequest("POST", "/api/auth/login");
        request21.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse response21 = new MockHttpServletResponse();

        filter.doFilterInternal(request21, response21, chain);
        assertEquals(429, response21.getStatus());
    }
}
