package com.careerops.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.Profiles;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Makes the {@code test} profile boot on any laptop even when a copied
 * {@code .env} left blank {@code APP_*} / {@code JWT_*} values in the
 * environment (empty env vars override {@code application-test.properties}).
 *
 * Also ensures the H2 data directory exists before Hikari connects.
 */
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class LocalDevDefaultsEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String SOURCE = "localDevDefaults";

    /** Same RSA test keypair as application-test.properties (local only). */
    private static final String TEST_JWT_PRIVATE =
            "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDJIz0u+eiBEkIYNQ6MQ18I10LSinE4W+BJ5zQyvLgUFQA/p0RfTOt6xv3AAW5jlcn6LRkdXV6GyUDVGJn22M3MonS66+54zK7afrDMkfh9s0ZT74A+X8xw+rlxOWSHyuZf27P5kZ1WHoFNL8KP5ljOYYSP+fgZP7tcchUGbHpNLyB9Dcojz2BqniNimJAhQ7groRWZ9fDgl1S2jJMFNgKvAQvVNzG1WroKmPtn/XTuy5aXRoNS8osnU3Zf9oJUrppb0rEW6znKG0rES+4M5QVLUBcS8Xqr3B/THYCDrMvEuRwa3pXokfwR4OpAfhs82hoj/rXSfXhTHJclaI1tE8odAgMBAAECggEAC4GFjXtkToXh3Aqk82cjN5lAzFR5F5VB5lhghwp+qT9uTTXfVmhLDDH38BTk4LN/41zTE/f0YVd/6vDGVfWfCDa+4LaAZM6orf0TVhB/m4k227RWrLrEMi5Vj2GOG6qCtTcXO46V5ohGM0kpIxw1NlEjySyugZtAt5AbHcv0zxdp+khuzsN8Ff1Ge6O31IHtb0B0NbHB7rO4RRT5dHnFqhdQLhhe1FeLATUO+U39hcv6XgO2Qztmk1WL71J+Gxw0e271qR0gqYmMNL4vgZrAWRIlQzBvlknJKmFllpwD6t2a0fCTR6el5qx+PBX+vc6q/wHNSLuPBtj8axcxlJHszQKBgQD54Qq74p0BmMNZeBdguTHvrBCecsKzkZL+BJcKDn3ktGYNipl8HDcwcl2jSagVqaXh8NKs5PxFo3Vu30NDRq1I4aHEiQT0zitXDTFkP4xQBV5U5H1WrFWul8WuoPrv02dCOIU34/1Pj20rkCBITXUk0IeKrCde1Od2CiyX75jJJwKBgQDOEIvS+FEb3kIA0qjTncIHyUBV9OBd/FkDiaeEW6D1fs52K/yhZ8/L6pQ9HwTOyzl/QH9tV8rbAkEXoH3i9y1A1yo5x4vgJnbmhDRmt9G2T0QE33f611kjcajOz/GIcDnEnEMF6ijQZ8tK1pcgc7PXPA69uIuDyOkKtCaKOxK1GwKBgFkfwiNXZWafZPWxVq1CAKSae2b4SaeggYwmePS2TILZMRkdWTciHTEjaXCHIfNwCeF3cr0GA1CXR5he+2+wcrfu+jLOKD1kl6K56ub1n4cfExE2WdojJ4BZU8HAWyBVB5xf6mwP3laVMnv6MPl43xJdaiq00moJh/DbGiKq65S7AoGBAKAFL1/0n5/hmCXlcV9sGfpL6Z8Wm4nA5iseIa1iLnuWLqSMAhIheLelAdr5FJW2MX9FSe9ShuBOPtgnNLslMcoxjMPz1waJODpInhzKUJufsHWMSDLOOpWQtQNtbeaDKAkrQ8z7CxjUEYWbYR69WwIgzF2+SvFa+sXqIiekOiHTAoGBAPhIyxOLZf2MEwixtjFkWl0KRm6gSSJtUMDmaxBOenJnM6LNifJ1pZxIHn+VGbxKhIomyx5/gg4Q3sXbz3oBneAVipu/zcYM4bNFTWZHV0cn7NI2bwmRPh8enOFFxpzxgKEY9OMG2kSfXrM1EbctF7I4F3bVHybHSXqyvXfuX488";

    private static final String TEST_JWT_PUBLIC =
            "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAySM9LvnogRJCGDUOjENfCNdC0opxOFvgSec0Mry4FBUAP6dEX0zresb9wAFuY5XJ+i0ZHV1ehslA1RiZ9tjNzKJ0uuvueMyu2n6wzJH4fbNGU++APl/McPq5cTlkh8rmX9uz+ZGdVh6BTS/Cj+ZYzmGEj/n4GT+7XHIVBmx6TS8gfQ3KI89gap4jYpiQIUO4K6EVmfXw4JdUtoyTBTYCrwEL1TcxtVq6Cpj7Z/107suWl0aDUvKLJ1N2X/aCVK6aW9KxFus5yhtKxEvuDOUFS1AXEvF6q9wf0x2Ag6zLxLkcGt6V6JH8EeDqQH4bPNoaI/610n14UxyXJWiNbRPKHQIDAQAB";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!environment.acceptsProfiles(Profiles.of("test"))) {
            return;
        }

        ensureH2Directory(environment);

        Map<String, Object> fixes = new LinkedHashMap<>();
        putIfBlank(environment, fixes, "app.internal.secret", "test-internal-trust-secret-minimum-32-characters-long");
        putIfBlank(environment, fixes, "APP_INTERNAL_SECRET", "test-internal-trust-secret-minimum-32-characters-long");
        putIfBlank(environment, fixes, "app.master.kek", "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=");
        putIfBlank(environment, fixes, "APP_MASTER_KEK", "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=");
        putIfBlank(environment, fixes, "app.encryption.key", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
        putIfBlank(environment, fixes, "APP_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
        putIfBlank(environment, fixes, "app.otp.pepper", "local-dev-only-change-in-prod-32chars-min");
        putIfBlank(environment, fixes, "APP_OTP_PEPPER", "local-dev-only-change-in-prod-32chars-min");

        putIfBlank(environment, fixes, "jwt.private-key", TEST_JWT_PRIVATE);
        putIfBlank(environment, fixes, "jwt.public-key", TEST_JWT_PUBLIC);
        putIfBlank(environment, fixes, "jwt.private-key-pem", TEST_JWT_PRIVATE);
        putIfBlank(environment, fixes, "jwt.public-key-pem", TEST_JWT_PUBLIC);
        putIfBlank(environment, fixes, "JWT_PRIVATE_KEY_PEM", TEST_JWT_PRIVATE);
        putIfBlank(environment, fixes, "JWT_PUBLIC_KEY_PEM", TEST_JWT_PUBLIC);

        if (!fixes.isEmpty()) {
            environment.getPropertySources().addFirst(new MapPropertySource(SOURCE, fixes));
        }
    }

    private static void putIfBlank(
            ConfigurableEnvironment env, Map<String, Object> fixes, String key, String value) {
        String current = env.getProperty(key);
        if (current == null || current.isBlank()) {
            fixes.put(key, value);
        }
    }

    private static void ensureH2Directory(ConfigurableEnvironment environment) {
        String url = environment.getProperty("spring.datasource.url", "");
        if (!url.startsWith("jdbc:h2:file:")) {
            return;
        }
        try {
            String pathPart = url.substring("jdbc:h2:file:".length());
            int semi = pathPart.indexOf(';');
            if (semi > 0) {
                pathPart = pathPart.substring(0, semi);
            }
            pathPart = pathPart.replace("${user.home}", System.getProperty("user.home", "."));
            Path dbFile = Path.of(pathPart).toAbsolutePath().normalize();
            Path parent = dbFile.getParent();
            if (parent != null && !Files.isDirectory(parent)) {
                Files.createDirectories(parent);
            }
        } catch (Exception ignored) {
            // Boot continues; H2 surfaces a clearer error if the path is invalid
        }
    }
}
