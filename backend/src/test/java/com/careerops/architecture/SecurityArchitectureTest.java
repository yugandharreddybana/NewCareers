package com.careerops.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.fields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;

/**
 * Issue 2.052 — Architecture Tests for Security.
 * Ensures that state-changing methods in controllers are only accessible via JWT.
 * In a real-world scenario, this would verify that no session-cookie flows exist.
 * For now, it enforces that all state-changing endpoints in controllers
 * reside within a package that is protected by our JWT SecurityConfig.
 */
@AnalyzeClasses(packages = "com.careerops", importOptions = ImportOption.DoNotIncludeTests.class)
public class SecurityArchitectureTest {

    @ArchTest
    public static final ArchRule state_changing_endpoints_must_be_in_controller_package =
            methods().that().areAnnotatedWith(PostMapping.class)
                    .or().areAnnotatedWith(PutMapping.class)
                    .or().areAnnotatedWith(PatchMapping.class)
                    .or().areAnnotatedWith(DeleteMapping.class)
                    .should().beDeclaredInClassesThat().resideInAPackage("..controller..")
                    .as("All state-changing endpoints must be in the controller package to ensure they are picked up by the JWT security filter chain.");

    @ArchTest
    public static final ArchRule entities_must_not_store_raw_tokens =
            fields().that().haveNameMatching("(?i).*rawToken.*|(?i)^token$")
                    .and().areDeclaredInClassesThat().resideInAPackage("..model..")
                    .should().notHaveRawType(String.class)
                    .as("JPA entities must not store raw/plain-text tokens as String. Use hashed-only or encrypted formats instead.");

    // This is a simplified rule. In a more complex app, we'd verify that
    // no cookie-based authentication filters are registered for these paths.
}
