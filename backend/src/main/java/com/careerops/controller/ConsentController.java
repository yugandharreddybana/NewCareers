package com.careerops.controller;

import com.careerops.dto.ConsentDtos.ConsentResponse;
import com.careerops.dto.ConsentDtos.ConsentStatusResponse;
import com.careerops.dto.ConsentDtos.UpdateConsentRequest;
import com.careerops.model.UserConsent;
import com.careerops.service.UserConsentService;
import com.careerops.util.AuthUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/consents")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class ConsentController {

    private final UserConsentService consentService;

    @GetMapping
    public ConsentStatusResponse getStatus() {
        UUID userId = AuthUtil.currentUserId();
        return consentService.getStatus(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConsentResponse updateConsent(
            @RequestBody @Valid UpdateConsentRequest req,
            HttpServletRequest httpRequest) {
        UUID userId = AuthUtil.currentUserId();
        UserConsent saved = consentService.updateConsent(
                userId,
                req.consentType(),
                req.version(),
                req.accepted(),
                httpRequest);
        return toResponse(saved);
    }

    private static ConsentResponse toResponse(UserConsent row) {
        return new ConsentResponse(
                row.getId(),
                row.getConsentType(),
                row.getVersion(),
                row.isAccepted(),
                row.getAcceptedAt());
    }
}
