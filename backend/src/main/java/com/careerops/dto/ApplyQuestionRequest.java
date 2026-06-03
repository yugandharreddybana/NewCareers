package com.careerops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ApplyQuestionRequest(
    @NotNull UUID userJobId,
    @NotBlank @Size(max = 4000) String question,
    boolean rerun
) {}
