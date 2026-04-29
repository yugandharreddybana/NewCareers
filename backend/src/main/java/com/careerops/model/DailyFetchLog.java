package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "daily_fetch_log", schema = "career_operations")
@IdClass(DailyFetchLog.PK.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DailyFetchLog {
    @Id @Column(name = "user_id") private UUID userId;
    @Id @Column(name = "fetch_date") private LocalDate fetchDate;
    private Integer count;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class PK implements Serializable {
        private UUID userId;
        private LocalDate fetchDate;
        @Override public boolean equals(Object o){
            if(!(o instanceof PK p))return false;
            return Objects.equals(userId,p.userId)&&Objects.equals(fetchDate,p.fetchDate);
        }
        @Override public int hashCode(){return Objects.hash(userId,fetchDate);}
    }
}
