package com.regulaone.backend.configs;

import com.regulaone.backend.repository.UserRepository;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

@Component
public class CognitoJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private static final Logger log = LoggerFactory.getLogger(CognitoJwtConverter.class);

    private final UserRepository userRepository;

    public CognitoJwtConverter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        String sub   = jwt.getSubject();
        String email = jwt.getClaimAsString("email");

        log.info("=== CognitoJwtConverter ===");
        log.info("JWT sub   : {}", sub);
        log.info("JWT email : {}", email);

        List<GrantedAuthority> authorities = resolveAuthorities(sub, email);

        log.info("Resolved authority : {}", authorities);
        log.info("===========================");

        return new JwtAuthenticationToken(jwt, authorities, email != null ? email : sub);
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
                            ? userRepository.findByEmail(email).map(user -> {
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
