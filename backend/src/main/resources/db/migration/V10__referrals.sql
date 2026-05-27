-- Section 9 — Task 93: Refer-a-Friend referrals table
SET search_path TO careerops;

CREATE TABLE referrals (
    id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id   UUID         NOT NULL
                               REFERENCES users(id) ON DELETE CASCADE,
    referee_email VARCHAR(255) NOT NULL,
    token         UUID         NOT NULL DEFAULT gen_random_uuid(),
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                               CONSTRAINT chk_referral_status
                               CHECK (status IN ('pending','signed_up','rewarded')),
    rewarded_at   TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_referrals_token         UNIQUE (token),
    CONSTRAINT uq_referrals_referrer_email UNIQUE (referrer_id, referee_email)
);

-- Fast lookups by referrer (dashboard, stats)
CREATE INDEX idx_referrals_referrer_id  ON referrals(referrer_id);

-- Fast lookup on signup to match a pending referral
CREATE INDEX idx_referrals_referee_email ON referrals(referee_email);

