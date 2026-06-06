package com.careerops.config;

import com.careerops.security.HmacRequestInterceptor;
import com.careerops.security.InternalHmacSigner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class InternalRestTemplateConfig {

    @Bean
    RestTemplate internalRestTemplate(InternalHmacSigner signer) {
        RestTemplate restTemplate = new RestTemplate();
        restTemplate.getInterceptors().add(new HmacRequestInterceptor(signer));
        return restTemplate;
    }
}
