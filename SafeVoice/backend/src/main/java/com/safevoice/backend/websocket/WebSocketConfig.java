package com.safevoice.backend.websocket;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;


/**
 * STOMP-over-WebSocket setup for SafeVoice real-time features.
 *
 * Clients connect to "/ws" (SockJS). Messages flow over destinations:
 *   /app/...   — client → server (handled by @MessageMapping controllers)
 *   /topic/... — server → many subscribers (tenant feeds, per-case chat/typing/presence)
 *   /user/...  — server → one specific connection (e.g. the ping reply)
 *
 * Every inbound frame passes through {@link StompAuthChannelInterceptor}, which
 * authenticates the CONNECT and authorises each SUBSCRIBE (tenant/case isolation).
 *
 * NOTE: this uses the built-in in-memory broker, which is per-instance. For a multi-node
 * deployment we will need sticky sessions or an external relay (RabbitMQ/Redis); that is a
 * later concern and does not affect single-instance dev.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final CookieHandshakeInterceptor cookieHandshakeInterceptor;
    private final StompAuthChannelInterceptor authChannelInterceptor;

    // The browser origins allowed to open a socket — same list as the REST CORS config.
    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    public WebSocketConfig(StompAuthChannelInterceptor authChannelInterceptor) {
        this.cookieHandshakeInterceptor = new CookieHandshakeInterceptor();
        this.authChannelInterceptor = authChannelInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins.split(","))
                .addInterceptors(cookieHandshakeInterceptor)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Simple in-memory broker for these destination prefixes.
        registry.enableSimpleBroker("/topic", "/queue");
        // Client→server sends are prefixed with /app.
        registry.setApplicationDestinationPrefixes("/app");
        // Per-connection destinations are prefixed with /user.
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Authenticate CONNECT and authorise SUBSCRIBE before anything reaches the broker.
        registration.interceptors(authChannelInterceptor);
    }
}
