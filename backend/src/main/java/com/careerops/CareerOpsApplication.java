package com.careerops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync          // required for @Async in GeminiService to actually run asynchronously
public class CareerOpsApplication {
    public static void main(String[] args) {
        SpringApplication.run(CareerOpsApplication.class, args);
    }
}
