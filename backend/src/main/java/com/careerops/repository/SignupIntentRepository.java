package com.careerops.repository;

import com.careerops.model.SignupIntent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SignupIntentRepository extends JpaRepository<SignupIntent, UUID> {

    Optional<SignupIntent> findByIdAndEmail(UUID id, String email);
}
