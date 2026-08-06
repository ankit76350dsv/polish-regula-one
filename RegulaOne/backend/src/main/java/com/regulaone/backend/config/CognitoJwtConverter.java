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

        List<GrantedAuthority> roles = resolveAuthorities(sub, email);

        //? Spring Security stores this internally for the current request.
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(
                jwt,
                roles,
                email != null ? email : sub);

        // WHAT MAY AND MAY NOT BE LOGGED HERE
        //
        // This method runs on EVERY authenticated request, so anything logged at INFO
        // ends up in the log store for every request the platform ever serves. It used to
        // log the e-mail address and the whole authentication token at INFO, which put a
        // named person — and their token — into the logs a few times per page load. That
        // is personal data being processed for no stated purpose, and CLAUDE.md §17
        // forbids it.
        //
        // The SUBJECT ID is logged instead. It identifies the account for support and
        // incident work, but on its own it names nobody: turning it back into a person
        // needs access to the user directory. Never add the e-mail, the token or the
        // claims to these lines.
        log.debug("Authenticated subject {} with authorities {}", sub, roles);

        return authentication;
    }

    private List<GrantedAuthority> resolveAuthorities(String sub, String email) {

        Optional<String> roleName = userRepository.findByCognitoSub(sub)
                .map(user -> user.getRole().name())
                .or(() -> {
                    // The token verified but carries a subject we do not know. Falling back
                    // to the e-mail covers accounts created before the sub was stored.
                    log.debug("No user for subject {} — falling back to the e-mail claim", sub);
                    return email != null
                            ? userRepository.findByEmail(email).map(user -> user.getRole().name())
                            : Optional.empty();
                });

        // Worth a warning: a valid token with no account behind it means either a stale
        // session or a user removed mid-session. Identified by subject, never by e-mail.
        return List.of(new SimpleGrantedAuthority(roleName.orElseGet(() -> {
            log.warn("No RegulaOne account for subject {} — defaulting to ROLE_USER", sub);
            return "ROLE_USER";
        })));
    }
}