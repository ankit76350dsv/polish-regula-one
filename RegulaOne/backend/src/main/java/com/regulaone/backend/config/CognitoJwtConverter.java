package com.regulaone.backend.config;

import com.regulaone.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class CognitoJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserRepository userRepository;

    /**
     * Turn a verified Cognito token into a Spring Security identity.
     *
     * Spring hands us the already-decoded token; our job is to say what this person is
     * ALLOWED to do. The role is read from OUR database, never from a token claim, so a
     * role cannot be granted by anything the caller controls.
     */
    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        String sub = jwt.getSubject();
        String email = jwt.getClaimAsString("email");

        log.info("Subject ID : {}", sub);

        List<GrantedAuthority> roles = resolveAuthorities(sub, email);

        log.info("Resolved authority : {}", roles);

        //? Spring Security stores this internally for the current request.
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(
                jwt,
                roles,
                email != null ? email : sub);

        log.info("Authentication Token: {}", authentication);

        return authentication;
    }

    private List<GrantedAuthority> resolveAuthorities(String sub, String email) {
        log.info("Looking up MongoDB user by cognitoSub: {}", sub);

        Optional<String> roleName = userRepository.findByCognitoSub(sub)
                .map(user -> {
                    log.info("Found by cognitoSub → MongoDB role: {}", user.getRole().name());
                    return user.getRole().name();
                })
                .or(() -> {
                    log.warn("Not found by cognitoSub, trying email: {}", email);

                    return email != null
                            ? userRepository.findByEmail(email)
                                    .map(user -> {
                                        log.info("Found by email → MongoDB role: {}", user.getRole().name());
                                        return user.getRole().name();
                                    })
                            : Optional.empty();
                });

        String role = roleName.orElseGet(() -> {
            log.warn("User NOT found in MongoDB — defaulting to ROLE_USER");
            return "ROLE_USER";
        });

        return List.of(new SimpleGrantedAuthority(role));
    }
}