package com.careerops.controller;

import com.careerops.dto.ConsentDtos.AiConsentWithdrawalResponse;
import com.careerops.dto.ConsentDtos.WithdrawAiConsentResult;
import com.careerops.model.UserConsent;
import com.careerops.service.UserConsentService;
import com.careerops.util.AuthUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/user/consent")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class UserConsentController {

    private final UserConsentService consentService;

    @DeleteMapping("/ai")
    public AiConsentWithdrawalResponse withdrawAi(HttpServletRequest httpRequest) {
        UUID userId = AuthUtil.currentUserId();
        WithdrawAiConsentResult result = consentService.withdrawAiConsent(userId, httpRequest);
        return toResponse(result);
    }

    private static AiConsentWithdrawalResponse toResponse(WithdrawAiConsentResult result) {
        UserConsent row = result.consent();
        return new AiConsentWithdrawalResponse(
                row.getId(),
                row.getConsentType(),
                row.getVersion(),
                row.isAccepted(),
                row.getAcceptedAt(),
                result.skillRunsDeleted());
    }
}
