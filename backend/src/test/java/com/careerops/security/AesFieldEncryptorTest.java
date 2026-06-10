package com.careerops.security;

import com.careerops.service.UserKeyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AesFieldEncryptorTest {

    private static final byte[] LEGACY_KEY = new byte[32];
    private static final byte[] USER_DEK = new byte[32];
    private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");

    @Mock UserKeyService userKeyService;

    private AesFieldEncryptor encryptor;

    @BeforeEach
    void setUp() {
        USER_DEK[0] = 7;
        encryptor = AesFieldEncryptor.forTest(userKeyService, LEGACY_KEY);
        lenient().when(userKeyService.getUserDek(USER_ID)).thenReturn(USER_DEK);
    }

    @Test
    void encryptDecrypt_roundTripWithUserDek() {
        String plaintext = "Dublin, Ireland";
        String encrypted = encryptor.encrypt(plaintext, USER_ID);
        assertThat(encrypted).isNotEqualTo(plaintext);
        assertThat(encryptor.decrypt(encrypted, USER_ID)).isEqualTo(plaintext);
    }

    @Test
    void encrypt_generatesUniqueCiphertextPerCall() {
        String a = encryptor.encrypt("same", USER_ID);
        String b = encryptor.encrypt("same", USER_ID);
        assertThat(a).isNotEqualTo(b);
        assertThat(encryptor.decrypt(a, USER_ID)).isEqualTo("same");
        assertThat(encryptor.decrypt(b, USER_ID)).isEqualTo("same");
    }

    @Test
    void encrypt_nullAndBlankReturnNull() {
        assertThat(encryptor.encrypt(null, USER_ID)).isNull();
        assertThat(encryptor.encrypt("", USER_ID)).isNull();
        assertThat(encryptor.encrypt("   ", USER_ID)).isNull();
    }

    @Test
    void decrypt_nullAndBlankReturnNull() {
        assertThat(encryptor.decrypt(null, USER_ID)).isNull();
        assertThat(encryptor.decrypt("", USER_ID)).isNull();
        assertThat(encryptor.decrypt("   ", USER_ID)).isNull();
    }

    @Test
    void decrypt_legacyGlobalCiphertextFallback() {
        AesFieldEncryptor legacyOnly = AesFieldEncryptor.forTest(userKeyService, LEGACY_KEY);
        String legacyCipher = AesGcmCodec.encryptUtf8(AesGcmCodec.secretKey(LEGACY_KEY), "Legacy Town");
        when(userKeyService.getUserDek(USER_ID)).thenThrow(new IllegalStateException("no key"));

        assertThat(legacyOnly.decrypt(legacyCipher, USER_ID)).isEqualTo("Legacy Town");
    }

    @Test
    void decrypt_legacyPlaintextPassthrough() {
        assertThat(encryptor.decrypt("Dublin", USER_ID)).isEqualTo("Dublin");
        assertThat(encryptor.decrypt("not-valid-base64!!!", USER_ID)).isEqualTo("not-valid-base64!!!");
    }

    @Test
    void encrypt_requiresUserId() {
        assertThatThrownBy(() -> encryptor.encrypt("x", null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
