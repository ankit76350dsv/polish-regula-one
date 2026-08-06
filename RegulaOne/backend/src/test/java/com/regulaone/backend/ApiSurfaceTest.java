package com.regulaone.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.io.IOException;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Locks the public API contract of this service.
 *
 * WHY THIS TEST EXISTS
 *   Other applications and the browser frontend call these URLs. If a refactor
 *   quietly renames a path, drops a query parameter, changes the request body type
 *   or loosens an authorisation rule, every caller breaks — and nothing else in the
 *   build would have noticed. So the whole surface is written down once, in
 *   src/test/resources/api-surface.txt, and compared here on every run.
 *
 * WHAT IS COMPARED, per endpoint
 *   * the HTTP method(s) and the URL pattern(s)
 *   * required query-parameter conditions
 *   * the authorisation rule (@PreAuthorize on the method, or on the controller)
 *   * the handler's parameter list (so a lost @PathVariable or @RequestBody shows up)
 *   * the response type
 *
 * WHAT IS DELIBERATELY NOT COMPARED
 *   The controller CLASS the handler lives in. Moving an endpoint to a better-named
 *   class is exactly the kind of tidy-up this test should allow; changing what the
 *   endpoint IS, is what it should stop.
 *
 * IF THIS TEST FAILS
 *   Read the diff it prints. Either the change was unintended — fix the code — or
 *   the API is genuinely meant to change, in which case update the golden file in
 *   the SAME commit, so the change is visible in review.
 *
 * REGENERATING the golden file after an intended API change:
 *   ./mvnw test -Dtest=ApiSurfaceTest -Dapi.surface.write=target/api-surface.txt
 *   then copy that file over src/test/resources/api-surface.txt.
 */
@SpringBootTest
class ApiSurfaceTest {

    private static final String GOLDEN_FILE = "api-surface.txt";

    @Autowired
    private RequestMappingHandlerMapping handlerMapping;

    @Test
    void apiSurfaceMatchesTheRecordedContract() throws IOException {
        String actual = String.join("\n", describeAllEndpoints());

        // Escape hatch used only when the API is intentionally changed — see the class note.
        String writeTo = System.getProperty("api.surface.write");
        if (writeTo != null && !writeTo.isBlank()) {
            Path target = Path.of(writeTo);
            Files.createDirectories(target.getParent());
            Files.writeString(target, actual + "\n", StandardCharsets.UTF_8);
        }

        String expected = readGolden();
        assertEquals(expected, actual,
                "The HTTP API changed. Every recorded endpoint must keep its path, method, "
                        + "parameters, response type and authorisation rule.");
    }

    // ── Description building ────────────────────────────────────────────────────

    /** One stable, sorted text line per endpoint. */
    private List<String> describeAllEndpoints() {
        List<String> lines = new ArrayList<>();

        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry
                : handlerMapping.getHandlerMethods().entrySet()) {

            RequestMappingInfo info = entry.getKey();
            HandlerMethod handler = entry.getValue();

            // Only this application's own controllers; framework-supplied endpoints
            // (Swagger, actuator) are not part of the contract we are guarding.
            if (!handler.getBeanType().getName().startsWith("com.regulaone.backend")) {
                continue;
            }

            String httpMethods = sorted(info.getMethodsCondition().getMethods().stream()
                    .map(Enum::name).toList());
            String patterns = sorted(patternsOf(info));
            String params = sorted(info.getParamsCondition().getExpressions().stream()
                    .map(Object::toString).toList());

            lines.add("%s %s%s | auth=%s | args=%s | returns=%s".formatted(
                    httpMethods.isEmpty() ? "ANY" : httpMethods,
                    patterns,
                    params.isEmpty() ? "" : " params=" + params,
                    authorisationRuleOf(handler),
                    parameterListOf(handler.getMethod()),
                    handler.getMethod().getReturnType().getSimpleName()));
        }

        lines.sort(Comparator.naturalOrder());
        return lines;
    }

    private java.util.Collection<String> patternsOf(RequestMappingInfo info) {
        if (info.getPathPatternsCondition() != null) {
            return info.getPathPatternsCondition().getPatternValues();
        }
        return info.getPatternValues();
    }

    /**
     * The authorisation rule that applies to a handler: its own {@code @PreAuthorize}
     * when it has one, otherwise the controller's. "none" means the endpoint relies
     * solely on the URL rules in SecurityConfig.
     */
    private String authorisationRuleOf(HandlerMethod handler) {
        PreAuthorize onMethod = AnnotatedElementUtils.findMergedAnnotation(
                handler.getMethod(), PreAuthorize.class);
        if (onMethod != null) return onMethod.value();

        PreAuthorize onClass = AnnotatedElementUtils.findMergedAnnotation(
                handler.getBeanType(), PreAuthorize.class);
        return onClass != null ? onClass.value() : "none";
    }

    /**
     * The handler's parameters as "annotations type" pairs, so a dropped
     * {@code @PathVariable}, a renamed query parameter or a swapped request-body
     * type all change this line.
     */
    private String parameterListOf(Method method) {
        return java.util.Arrays.stream(method.getParameters())
                .map(this::describeParameter)
                .collect(Collectors.joining(", ", "(", ")"));
    }

    private String describeParameter(Parameter parameter) {
        String annotations = java.util.Arrays.stream(parameter.getAnnotations())
                .map(this::describeAnnotation)
                .sorted()
                .collect(Collectors.joining(""));
        return annotations + parameter.getType().getSimpleName();
    }

    /** Annotation name plus its non-default attributes, e.g. {@code @RequestParam(required=false)}. */
    private String describeAnnotation(Annotation annotation) {
        String text = annotation.toString();
        int firstBracket = text.indexOf('(');
        String simpleName = (firstBracket < 0 ? text : text.substring(0, firstBracket))
                .replace("@", "")
                .replaceAll(".*\\.", "");
        String attributes = firstBracket < 0 ? "" : text.substring(firstBracket);
        return "@" + simpleName + attributes + " ";
    }

    private String sorted(java.util.Collection<String> values) {
        return String.join(",", new TreeSet<>(values));
    }

    private String readGolden() throws IOException {
        try (var in = new ClassPathResource(GOLDEN_FILE).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).strip();
        }
    }
}
