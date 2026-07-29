package com.safevoice.backend.websocket;

import jakarta.servlet.http.Cookie;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * This runs once, right when a WebSocket is opening (the "handshake").
 *
 * What it does: it looks for the login cookie named "idToken" and saves its value into the
 * `attributes` map (the last parameter of beforeHandshake). That map becomes this socket's
 * "session attributes" — Spring keeps it for the whole life of the connection. So a moment
 * later, when the client says "CONNECT", we read the value back with
 * StompHeaderAccessor.getSessionAttributes().get("idToken").
 *
 * Where it is read: StompAuthChannelInterceptor.authenticate(), the staff branch.
 *
 * Why we do it here: the browser sends cookies by itself when the socket opens, but it is NOT
 * allowed to add our own custom headers at that moment. And once the socket is open, we can no
 * longer read the cookie. So we have to grab the cookie now and keep it.
 *
 * We do NOT decide who the user is here. We only save the cookie. The real check (is this a
 * staff member? a reporter?) happens next, at CONNECT. A reporter has no cookie — that is fine,
 * they prove who they are a different way (with their case access key) at CONNECT.
 */
public class CookieHandshakeInterceptor implements HandshakeInterceptor {

    public static final String ID_TOKEN_ATTR = "idToken";

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            Cookie[] cookies = servletRequest.getServletRequest().getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if (ID_TOKEN_ATTR.equals(cookie.getName())
                            && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                        // Map<String, Object> attributes hre the cokkie is storing
                        attributes.put(ID_TOKEN_ATTR, cookie.getValue());
                        break;
                    }
                }
            }
        }
        // Always allow the handshake to proceed; real auth happens at STOMP CONNECT.
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // nothing to do
    }
}
