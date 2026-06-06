package com.careerops.security;

import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import reactor.core.publisher.Mono;

import java.net.URI;

/**
 * Adds HMAC headers to outbound WebClient requests.
 * Body bytes are included when the request has no reactive body inserter (GET/DELETE).
 * For POST/PUT with a body, prefer {@link HmacRequestInterceptor} on {@code internalRestTemplate}.
 */
public final class HmacWebClientFilter {

    private HmacWebClientFilter() {
    }

    public static ExchangeFilterFunction signingFilter(InternalHmacSigner signer) {
        return ExchangeFilterFunction.ofRequestProcessor(request -> {
            long timestamp = System.currentTimeMillis();
            String path = URI.create(request.url().toString()).getPath();
            String signature = signer.sign(timestamp, request.method().name(), path, new byte[0]);
            ClientRequest signed = ClientRequest.from(request)
                    .headers(headers -> {
                        headers.set(InternalHmacSigner.TIMESTAMP_HEADER, String.valueOf(timestamp));
                        headers.set(InternalHmacSigner.SIGNATURE_HEADER, signature);
                    })
                    .build();
            return Mono.just(signed);
        });
    }
}
