package com.careerops.security;

import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;

public class HmacRequestInterceptor implements ClientHttpRequestInterceptor {

    private final InternalHmacSigner signer;

    public HmacRequestInterceptor(InternalHmacSigner signer) {
        this.signer = signer;
    }

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        long timestamp = System.currentTimeMillis();
        String path = URI.create(request.getURI().toString()).getPath();
        byte[] payload = body == null ? new byte[0] : body;
        String signature = signer.sign(timestamp, request.getMethod().name(), path, payload);

        request.getHeaders().set(InternalHmacSigner.TIMESTAMP_HEADER, String.valueOf(timestamp));
        request.getHeaders().set(InternalHmacSigner.SIGNATURE_HEADER, signature);
        return execution.execute(request, body);
    }
}
