package com.careerops.permit;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class PermitIngestionFailureListener {

    @EventListener
    public void onPermitIngestionFailed(PermitIngestionFailedEvent event) {
        log.error(
                "Permit ingestion failure recorded — exitCode={} args={} at={} stderrTail={}",
                event.exitCode(),
                event.args(),
                event.failedAt(),
                event.stderrTail());
    }
}
