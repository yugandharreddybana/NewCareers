package com.careerops.service.sources;

import com.careerops.model.UserProfile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AdzunaSourceTest {

    @Test
    @DisplayName("resolveCountryOrder prioritizes IE then GB for Ireland profiles")
    void resolveCountryOrder_prefersIrelandCountries() {
        assertThat(AdzunaSource.resolveCountryOrder("gb", true))
            .containsExactly("ie", "gb");

        assertThat(AdzunaSource.resolveCountryOrder("ie", true))
            .containsExactly("ie", "gb");

        assertThat(AdzunaSource.resolveCountryOrder("de", true))
            .containsExactly("ie", "gb", "de");
    }

    @Test
    @DisplayName("resolveCountryOrder keeps configured country for non-Ireland profiles")
    void resolveCountryOrder_nonIrelandProfiles() {
        assertThat(AdzunaSource.resolveCountryOrder("gb", false))
            .containsExactly("gb");

        assertThat(AdzunaSource.resolveCountryOrder("US", false))
            .containsExactly("us");
    }

    @Test
    @DisplayName("prefersIreland detects Ireland from location hints")
    void prefersIreland_detectsIrishLocationHints() {
        UserProfile profile = new UserProfile();
        profile.setLocation("Dublin, Ireland");
        assertThat(AdzunaSource.prefersIreland(profile)).isTrue();

        UserProfile second = new UserProfile();
        second.setGoalLocation("Galway");
        assertThat(AdzunaSource.prefersIreland(second)).isTrue();

        UserProfile third = new UserProfile();
        third.setLocation("Berlin, Germany");
        assertThat(AdzunaSource.prefersIreland(third)).isFalse();
    }

    @Test
    @DisplayName("isRepublicOfIrelandLocation keeps Republic locations and excludes UK/NI")
    void isRepublicOfIrelandLocation_filtersLocations() {
        List<String> accepted = List.of(
            "Dublin, Ireland",
            "Galway",
            "Remote, Ireland",
            "Republic of Ireland"
        );
        for (String location : accepted) {
            assertThat(AdzunaSource.isRepublicOfIrelandLocation(location))
                .withFailMessage("Expected accepted location: %s", location)
                .isTrue();
        }

        List<String> rejected = List.of(
            "Belfast, Northern Ireland",
            "London, UK",
            "County Antrim, Northern Ireland",
            "Ireland, Shefford"
        );
        for (String location : rejected) {
            assertThat(AdzunaSource.isRepublicOfIrelandLocation(location))
                .withFailMessage("Expected rejected location: %s", location)
                .isFalse();
        }
    }
}
