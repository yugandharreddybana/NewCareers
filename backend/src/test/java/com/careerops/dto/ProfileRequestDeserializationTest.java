package com.careerops.dto;

import com.careerops.config.JacksonConfig;
import com.careerops.dto.ProfileDtos.ProfileRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import static org.assertj.core.api.Assertions.assertThat;

class ProfileRequestDeserializationTest {

    private final ObjectMapper mapper = new JacksonConfig()
        .objectMapper(Jackson2ObjectMapperBuilder.json());

    @Test
    void deserializesOnboardingProfilePayload() throws Exception {
        String json = """
            {
              "name": "Jane Doe",
              "targetRoles": ["Software Engineer"],
              "techStack": ["React"],
              "sectors": ["Full-time"],
              "location": "Dublin, Ireland",
              "salaryMin": 60000,
              "salaryMax": 120000,
              "salaryCurrency": "EUR",
              "availability": "2 weeks notice",
              "experienceLevel": "senior",
              "sponsorshipRequired": true,
              "minMatchPercent": 60,
              "freshnessHours": 168,
              "openToRemote": true,
              "remotePolicy": "Remote",
              "workExperience": [{
                "jobTitle": "Engineer",
                "companyName": "Acme",
                "startDate": "2020-01",
                "endDate": "",
                "current": true,
                "description": "Built APIs"
              }],
              "education": [{
                "schoolName": "State U",
                "degree": "Bachelors",
                "degreeLevel": "bachelors",
                "degreeTitle": "BSc Computer Science",
                "fieldOfStudy": "CS",
                "startYear": "2016",
                "endYear": "2020",
                "graduationYear": "2020"
              }],
              "onboarded": true
            }
            """;

        ProfileRequest req = mapper.readValue(json, ProfileRequest.class);

        assertThat(req.name()).isEqualTo("Jane Doe");
        assertThat(req.sectors()).containsExactly("Full-time");
        assertThat(req.workExperience()).hasSize(1);
        assertThat(req.education().getFirst().getDegreeLevel()).isEqualTo("bachelors");
        assertThat(req.education().getFirst().getStartYear()).isEqualTo("2016");
        assertThat(req.education().getFirst().getEndYear()).isEqualTo("2020");
        assertThat(req.onboarded()).isTrue();
    }

    @Test
    void deserializesWorkTypesAliasWhenPresent() throws Exception {
        String json = """
            {
              "workTypes": ["Contract"],
              "onboarded": true
            }
            """;

        ProfileRequest req = mapper.readValue(json, ProfileRequest.class);

        assertThat(req.workTypes()).containsExactly("Contract");
    }
}
