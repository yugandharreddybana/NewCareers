package com.careerops.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = GoogleAuthConsentsValidator.class)
public @interface ValidGoogleAuthConsents {

    String message() default "You must accept the Terms of Service";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
