package com.careerops.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Per-user quota overrides keyed by normalized email. Only listed accounts receive
 * elevated limits; all other users follow plan tier / subscription enforcement.
 */
@ConfigurationProperties(prefix = "careerops")
public class QuotaGrantProperties {

    private List<QuotaGrantEntry> quotaGrants = new ArrayList<>();

    public List<QuotaGrantEntry> getQuotaGrants() {
        return quotaGrants;
    }

    public void setQuotaGrants(List<QuotaGrantEntry> quotaGrants) {
        this.quotaGrants = quotaGrants != null ? quotaGrants : new ArrayList<>();
    }

    public static class QuotaGrantEntry {
        private UUID userId;
        private String email = "";
        private long tokenBudget = 500_000L;
        private int jobsPerDay = 25;
        private boolean unlimitedSkills = true;
        private boolean unlimitedAccess = false;

        public UUID getUserId() {
            return userId;
        }

        public void setUserId(UUID userId) {
            this.userId = userId;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public long getTokenBudget() {
            return tokenBudget;
        }

        public void setTokenBudget(long tokenBudget) {
            this.tokenBudget = tokenBudget;
        }

        public int getJobsPerDay() {
            return jobsPerDay;
        }

        public void setJobsPerDay(int jobsPerDay) {
            this.jobsPerDay = jobsPerDay;
        }

        public boolean isUnlimitedSkills() {
            return unlimitedSkills;
        }

        public void setUnlimitedSkills(boolean unlimitedSkills) {
            this.unlimitedSkills = unlimitedSkills;
        }

        public boolean isUnlimitedAccess() {
            return unlimitedAccess;
        }

        public void setUnlimitedAccess(boolean unlimitedAccess) {
            this.unlimitedAccess = unlimitedAccess;
        }
    }
}
