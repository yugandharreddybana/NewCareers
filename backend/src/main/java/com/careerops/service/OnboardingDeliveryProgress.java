package com.careerops.service;

import java.util.List;

public class OnboardingDeliveryProgress {
    private int totalFetched;
    private int totalMatched;
    private List<String> sourceNames;

    public int getTotalFetched() { return totalFetched; }
    public void setTotalFetched(int totalFetched) { this.totalFetched = totalFetched; }
    public int getTotalMatched() { return totalMatched; }
    public void setTotalMatched(int totalMatched) { this.totalMatched = totalMatched; }
    public List<String> getSourceNames() { return sourceNames; }
    public void setSourceNames(List<String> sourceNames) { this.sourceNames = sourceNames; }
}
