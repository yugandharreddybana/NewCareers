package com.careerops.ratelimit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * + * Custom annotation to override the default 60 requests/minute rate limit.
 * + * Can be applied at the class or method level.
 * + *
 * + * Usage: @RateLimited(requestsPerMinute = 5)
 * +
 */
@Target({ ElementType.METHOD, ElementType.TYPE })
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimited {
    /** The number of tokens available in the bucket. Defaults to 60. */
    int capacity() default 60;

    /** The refill rate in tokens per minute. Defaults to 60. */
    int requestsPerMinute() default 60;
}
