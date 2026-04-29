package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import java.util.List;

public interface JobSource {
    String name();
    List<Job> fetch(UserProfile profile);
    default boolean hasBudget() { return true; }
}
