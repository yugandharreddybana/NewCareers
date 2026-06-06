package com.careerops.repository;

import com.careerops.model.CompanyYearHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompanyYearHistoryRepository extends JpaRepository<CompanyYearHistory, Long> {

    List<CompanyYearHistory> findByEmployerNameNormalisedOrderBySourceYearAsc(String employerNameNormalised);

    List<CompanyYearHistory> findBySourceYearAndGrandTotalGreaterThanOrderByGrandTotalDesc(
            int sourceYear,
            int grandTotal);

    Page<CompanyYearHistory> findBySourceYearAndGrandTotalGreaterThanOrderByGrandTotalDesc(
            int sourceYear,
            int grandTotal,
            Pageable pageable);
}
