package com.careerops.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String,Object>> api(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> generic(Exception e) {
        return ResponseEntity.status(500).body(Map.of("error","Internal server error","detail",e.getMessage()));
    }
}
