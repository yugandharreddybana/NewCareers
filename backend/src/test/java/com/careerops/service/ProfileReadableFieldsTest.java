package com.careerops.service;

import com.careerops.model.UserProfile;
import com.careerops.security.AesFieldEncryptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileReadableFieldsTest {

    private static final byte[] USER_DEK = new byte[32];
    private static final UUID USER_ID = UUID.randomUUID();

    @Mock UserKeyService userKeyService;

    ProfileReadableFields fields;

    @BeforeEach
    void setUp() {
        USER_DEK[0] = 9;
        when(userKeyService.getUserDek(USER_ID)).thenReturn(USER_DEK);
        fields = new ProfileReadableFields(AesFieldEncryptor.forTest(userKeyService, new byte[32]));
    }

    @Test
    void goalTitle_decryptsPlaintext() {
        UserProfile profile = new UserProfile();
        profile.setUserId(USER_ID);
        AesFieldEncryptor encryptor = AesFieldEncryptor.forTest(userKeyService, new byte[32]);
        profile.setGoalTitle(encryptor.encrypt("Senior Engineer", USER_ID));

        assertThat(fields.goalTitle(profile)).isEqualTo("Senior Engineer");
    }

    @Test
    void goalTitle_returnsNullForEncryptedLookingValue() {
        UserProfile profile = new UserProfile();
        profile.setUserId(USER_ID);
        profile.setGoalTitle("F+ltIU+rCn9abcdefghijklmnopqrstuvwxyz0123456789+/=");

        assertThat(fields.goalTitle(profile)).isNull();
    }
}
