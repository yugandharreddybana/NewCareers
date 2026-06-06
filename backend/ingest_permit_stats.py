#!/usr/bin/env python3
# requirements: requests==2.31.0, beautifulsoup4==4.12.3,
#               openpyxl==3.1.2, psycopg2-binary==2.9.9,
#               numpy==1.26.4, lxml==5.1.0, xlrd==2.0.1
"""
Multi-year employment permit statistics ingestion (enterprise.gov.ie, 2009–2026).

Loads companies, sectors, and counties into PostgreSQL (Flyway V100 schema).
Default CLI behaviour: ingest live year 2026 only (suitable for daily cron).

Usage:
  python ingest_permit_stats.py --live-only
  python ingest_permit_stats.py --all --rebuild-scores
  python ingest_permit_stats.py --years 2022 2023 2024 --force
  python ingest_permit_stats.py --year 2024 --dry-run
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
import tempfile
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Optional
from urllib.parse import urljoin

import numpy as np
import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook

try:
    import xlrd
except ImportError:
    xlrd = None  # type: ignore

# ─── Year registry ────────────────────────────────────────────────────────────

YEAR_SOURCES = {
    2009: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2009.html",
    2010: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2010.html",
    2011: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2011.html",
    2012: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2012.html",
    2013: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2013.html",
    2014: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2014.html",
    2015: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2015.html",
    2016: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2016.html",
    2017: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2017.html",
    2018: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2018.html",
    2019: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2019.html",
    2020: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2020.html",
    2021: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2021.html",
    2022: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2022.html",
    2023: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2023.html",
    2024: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2024.html",
    2025: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2025.html",
    2026: "https://enterprise.gov.ie/en/publications/employment-permit-statistics-2026.html",
}

FULL_YEARS = set(range(2009, 2026))  # 2009–2025 complete annual datasets
LIVE_YEARS = {2026}  # partial / live — re-ingest daily

BASE_SITE = "https://enterprise.gov.ie"
USER_AGENT = (
    "Mozilla/5.0 (compatible; CareerOps/1.0; +https://careerops.ie) "
    "PermitStatsIngest/1.0"
)
REQUEST_TIMEOUT = 60
BATCH_SIZE = 500
TMP_DIR = Path(
    os.getenv("PERMIT_XLSX_CACHE", os.getenv("TMPDIR", tempfile.gettempdir()))
)

MONTH_KEYS = (
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
)

MONTH_HEADER_RE = re.compile(
    r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)\b",
    re.I,
)

SUFFIX_RE = re.compile(
    r"\b("
    r"l\.?\s*l\.?\s*c\.?|ltd\.?|limited|plc\.?|inc\.?|llc|dac|uc|clg|"
    r"t\s*/\s*a|trading\s+as|teoranta|cuideachta|unlimited\s+company|"
    r"public\s+limited\s+company"
    r")\b\.?",
    re.I,
)

SECTOR_CODE_RE = re.compile(r"^\s*([A-Za-z])\s*[-–—]\s*(.+)$")

GRAND_TOTAL_MARKERS = ("grand total", "total for", "total =")

log = logging.getLogger("ingest_permit_stats")


# ─── Data models ──────────────────────────────────────────────────────────────


@dataclass
class CompanyRow:
    employer_name: str
    employer_name_normalised: str
    permits: dict[str, Optional[int]] = field(default_factory=dict)
    grand_total: int = 0
    status: str = "ACTIVE"
    momentum: Optional[str] = None
    rank_overall: Optional[int] = None


@dataclass
class SectorRow:
    sector_code: str
    sector_name: str
    permits: dict[str, Optional[int]] = field(default_factory=dict)
    grand_total: int = 0


@dataclass
class CountyRow:
    county: str
    issued: int = 0
    refused: int = 0


@dataclass
class YearResult:
    year: int
    companies: int = 0
    sectors: int = 0
    counties: int = 0
    status: str = "PENDING"
    message: str = ""


# ─── Name normalisation ───────────────────────────────────────────────────────


def normalise_name(name: str) -> str:
    """Lowercase, strip legal suffixes and punctuation for cross-year matching."""
    if not name:
        return ""
    text = str(name).strip().lower()
    text = SUFFIX_RE.sub(" ", text)
    # Normalise punctuation to spaces (hyphens included — see HSE example in docstring).
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ─── HTTP / download ──────────────────────────────────────────────────────────


def fetch_page(url: str) -> BeautifulSoup:
    resp = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "lxml")


def resolve_href(href: str) -> str:
    if href.startswith("http://") or href.startswith("https://"):
        return href
    return urljoin(BASE_SITE, href)


def pick_spreadsheet_link(
    soup: BeautifulSoup,
    *,
    kind: str,
) -> Optional[tuple[str, str]]:
    """
    Find companies / sectors / counties download URL.
    Prefers .xlsx; falls back to legacy .xls when needed.
    """
    patterns = {
        "companies": ("compan",),  # companies, companes (2009 typo), employment-permits-issued-to-companies
        "sectors": ("sector",),
        "counties": ("county",),
    }
    needles = patterns[kind]
    xlsx_match: Optional[tuple[str, str]] = None
    xls_match: Optional[tuple[str, str]] = None

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        lower = href.lower()
        if not any(n in lower for n in needles):
            continue
        if lower.endswith(".xlsx"):
            xlsx_match = (resolve_href(href), lower)
        elif lower.endswith(".xls") and xls_match is None:
            xls_match = (resolve_href(href), lower)

    return xlsx_match or xls_match


def download_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    resp = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT,
        stream=True,
    )
    resp.raise_for_status()
    with dest.open("wb") as fh:
        for chunk in resp.iter_content(chunk_size=65536):
            if chunk:
                fh.write(chunk)


def tmp_path(year: int, kind: str, ext: str) -> Path:
    return TMP_DIR / f"permits_{year}_{kind}{ext}"


def should_skip_download(year: int, path: Path, force: bool) -> bool:
    return (
        path.exists()
        and path.stat().st_size > 0
        and not force
        and year in FULL_YEARS
    )


# ─── Spreadsheet I/O ──────────────────────────────────────────────────────────


def iter_sheet_rows(path: Path) -> Iterator[tuple[Any, ...]]:
    """Yield rows from .xlsx (openpyxl) or legacy .xls (xlrd)."""
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        wb = load_workbook(path, read_only=True, data_only=True)
        try:
            ws = wb.active
            for row in ws.iter_rows(values_only=True):
                yield row
        finally:
            wb.close()
    elif suffix == ".xls":
        if xlrd is None:
            raise RuntimeError("xlrd is required for legacy .xls files (pip install xlrd)")
        book = xlrd.open_workbook(str(path))
        sheet = book.sheet_by_index(0)
        for r in range(sheet.nrows):
            yield tuple(sheet.row_values(r))
    else:
        raise ValueError(f"Unsupported spreadsheet type: {path}")


def cell_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def cell_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        if isinstance(value, float):
            if value != value:  # NaN
                return None
            return int(round(value))
        if isinstance(value, str):
            cleaned = value.replace(",", "").strip()
            if not cleaned:
                return None
            return int(round(float(cleaned)))
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def is_grand_total_row(label: str) -> bool:
    lower = label.lower()
    return any(m in lower for m in GRAND_TOTAL_MARKERS)


def map_month_columns(header: tuple[Any, ...]) -> dict[str, int]:
    """Map jan..dec and grand_total to column indexes from a header row."""
    mapping: dict[str, int] = {}
    for idx, raw in enumerate(header):
        label = cell_str(raw).lower()
        if not label:
            continue
        if "grand" in label and "total" in label:
            mapping["grand_total"] = idx
            continue
        if label in ("total", "permits issued grand total") or (
            label.endswith(" total") and "grand" not in label
        ):
            if "grand_total" not in mapping:
                mapping["grand_total"] = idx
            continue
        match = MONTH_HEADER_RE.search(label)
        if match:
            token = match.group(1).lower()[:3]
            key = {
                "jan": "jan", "feb": "feb", "mar": "mar", "apr": "apr",
                "may": "may", "jun": "jun", "jul": "jul", "aug": "aug",
                "sep": "sep", "oct": "oct", "nov": "nov", "dec": "dec",
            }.get(token[:3])
            if key:
                mapping[key] = idx
    return mapping


def find_header_row(rows: list[tuple[Any, ...]], max_scan: int = 30) -> Optional[int]:
    for i, row in enumerate(rows[:max_scan]):
        for cell in row:
            text = cell_str(cell).lower()
            if "employer" in text or text == "company name" or text.startswith("company"):
                return i
    return None


def parse_sector_code_and_name(raw: str) -> tuple[str, str]:
    text = cell_str(raw)
    if not text:
        return ("", "")
    match = SECTOR_CODE_RE.match(text)
    if match:
        return (match.group(1).upper(), text)
    first = text.split()[0] if text.split() else text
    return (first[:10].upper(), text)


def compute_momentum(
    permits: dict[str, Optional[int]],
    *,
    year: int,
) -> Optional[str]:
    months_with_data = [
        k for k in MONTH_KEYS if permits.get(k) is not None
    ]
    if len(months_with_data) < 4:
        return None

    if year in LIVE_YEARS:
        first_keys = ("jan", "feb")
        second_keys = ("mar", "apr")
    else:
        first_keys = MONTH_KEYS[:6]
        second_keys = MONTH_KEYS[6:]

    first = sum(permits.get(k) or 0 for k in first_keys)
    second = sum(permits.get(k) or 0 for k in second_keys)
    if first == 0 and second == 0:
        return None
    if first == 0:
        return "RISING"
    if second > first * 1.1:
        return "RISING"
    if second < first * 0.9:
        return "DECLINING"
    return "FLAT"


def assign_company_ranks(companies: list[CompanyRow]) -> None:
    ranked = sorted(companies, key=lambda c: c.grand_total, reverse=True)
    for rank, company in enumerate(ranked, start=1):
        company.rank_overall = rank


# ─── Parsers ──────────────────────────────────────────────────────────────────


def parse_companies_file(path: Path, year: int) -> list[CompanyRow]:
    rows = list(iter_sheet_rows(path))
    if not rows:
        return []

    header_idx = find_header_row(rows)
    if header_idx is None:
        log.warning("No company header row in %s — trying legacy layout", path.name)
        return _parse_companies_legacy(rows, year)

    header = rows[header_idx]
    col_map = map_month_columns(header)

    name_col = 0
    for idx, cell in enumerate(header):
        text = cell_str(cell).lower()
        if "employer" in text or "company" in text:
            name_col = idx
            break

    companies: list[CompanyRow] = []
    for row in rows[header_idx + 1 :]:
        if not row or all(cell_str(c) == "" for c in row):
            continue
        name = cell_str(row[name_col] if name_col < len(row) else "")
        if not name or is_grand_total_row(name):
            continue

        permits: dict[str, Optional[int]] = {}
        for month in MONTH_KEYS:
            if month in col_map and col_map[month] < len(row):
                permits[month] = cell_int(row[col_map[month]])

        grand_total: Optional[int] = None
        if "grand_total" in col_map and col_map["grand_total"] < len(row):
            grand_total = cell_int(row[col_map["grand_total"]])

        if grand_total is None:
            month_vals = [permits[m] for m in MONTH_KEYS if permits.get(m) is not None]
            if month_vals:
                grand_total = sum(v or 0 for v in month_vals)
            else:
                # Annual-only column (e.g. 2012 "Total")
                for idx, cell in enumerate(header):
                    if cell_str(cell).lower() == "total" and idx < len(row):
                        grand_total = cell_int(row[idx])
                        break
        if grand_total is None:
            grand_total = 0

        status = "ACTIVE" if grand_total > 0 else "INACTIVE"
        companies.append(
            CompanyRow(
                employer_name=name,
                employer_name_normalised=normalise_name(name),
                permits=permits,
                grand_total=grand_total,
                status=status,
                momentum=compute_momentum(permits, year=year),
            )
        )

    assign_company_ranks(companies)
    return companies


def _parse_companies_legacy(rows: list[tuple[Any, ...]], year: int) -> list[CompanyRow]:
    """2009-style County / Company Name / Total layouts."""
    header_idx = None
    for i, row in enumerate(rows[:40]):
        cells = [cell_str(c).lower() for c in row]
        if "company name" in cells:
            header_idx = i
            break
    if header_idx is None:
        return []

    header = [cell_str(c).lower() for c in rows[header_idx]]
    name_col = header.index("company name") if "company name" in header else 1
    total_col = None
    for label in ("total", "grand total"):
        if label in header:
            total_col = header.index(label)
            break
    if total_col is None:
        total_col = len(header) - 1

    aggregated: dict[str, CompanyRow] = {}
    for row in rows[header_idx + 1 :]:
        if not row:
            continue
        name = cell_str(row[name_col] if name_col < len(row) else "")
        if not name or is_grand_total_row(name) or name.lower().startswith("total for"):
            continue
        total = cell_int(row[total_col] if total_col < len(row) else None) or 0
        norm = normalise_name(name)
        if norm in aggregated:
            aggregated[norm].grand_total += total
        else:
            aggregated[norm] = CompanyRow(
                employer_name=name,
                employer_name_normalised=norm,
                grand_total=total,
                status="ACTIVE" if total > 0 else "INACTIVE",
            )

    companies = list(aggregated.values())
    assign_company_ranks(companies)
    return companies


def parse_sectors_file(path: Path, year: int) -> list[SectorRow]:
    rows = list(iter_sheet_rows(path))
    if not rows:
        return []

    # Row 0 = month names only (2026-style); sector label in column 0 from row 1
    if len(rows) > 1 and len(map_month_columns(rows[0])) >= 2:
        return _parse_sectors_modern(rows, 0, year, name_col=0, data_start=1)

    # Modern layout: "Economic Sector" + month columns (2020+)
    for i, row in enumerate(rows[:15]):
        labels = [cell_str(c).lower() for c in row]
        if any("economic sector" in x for x in labels) or (
            labels and labels[0] == "economic sector"
        ):
            return _parse_sectors_modern(rows, i, year)

    # 2024-style: month row then "Economic Sector" header row
    for i, row in enumerate(rows[:10]):
        joined = " ".join(cell_str(c).lower() for c in row)
        if "economic sector" in joined:
            month_row = rows[i - 1] if i > 0 else row
            combined = tuple(
                (cell_str(a) or cell_str(b))
                for a, b in zip(month_row, row)
            ) if i > 0 else row
            return _parse_sectors_modern(rows, i, year, header_override=combined)

    # Hierarchical Year / Month / Sector (2010–2019)
    return _parse_sectors_hierarchical(rows)


def _parse_sectors_modern(
    rows: list[tuple[Any, ...]],
    header_idx: int,
    year: int,
    *,
    name_col: int = 0,
    data_start: Optional[int] = None,
    header_override: Optional[tuple[Any, ...]] = None,
) -> list[SectorRow]:
    header = header_override or rows[header_idx]
    col_map = map_month_columns(header)
    if header_override is None:
        for idx, cell in enumerate(rows[header_idx]):
            if "sector" in cell_str(cell).lower():
                name_col = idx
                break

    start = data_start if data_start is not None else header_idx + 1
    sectors: list[SectorRow] = []
    for row in rows[start:]:
        if not row:
            continue
        raw_name = cell_str(row[name_col] if name_col < len(row) else "")
        if not raw_name or is_grand_total_row(raw_name):
            continue
        code, name = parse_sector_code_and_name(raw_name)
        if not code:
            continue

        permits: dict[str, Optional[int]] = {}
        for month in MONTH_KEYS:
            if month in col_map and col_map[month] < len(row):
                permits[month] = cell_int(row[col_map[month]])

        grand_total = None
        if "grand_total" in col_map and col_map["grand_total"] < len(row):
            grand_total = cell_int(row[col_map["grand_total"]])
        if grand_total is None:
            vals = [permits[m] for m in MONTH_KEYS if permits.get(m) is not None]
            grand_total = sum(vals) if vals else 0
        if grand_total is None:
            grand_total = 0

        sectors.append(
            SectorRow(
                sector_code=code,
                sector_name=name,
                permits=permits,
                grand_total=grand_total or 0,
            )
        )
    return sectors


def _parse_sectors_hierarchical(rows: list[tuple[Any, ...]]) -> list[SectorRow]:
    """
    Aggregate sector totals from Year/Month/Sector rows (legacy 2010–2019 workbooks).
    """
    sector_monthly: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    sector_labels: dict[str, str] = {}

    for row in rows:
        if len(row) < 4:
            continue
        month_cell = cell_str(row[1] if len(row) > 1 else "").lower()
        sector_cell = ""
        for idx in (2, 3):
            if idx < len(row) and cell_str(row[idx]):
                sector_cell = cell_str(row[idx])
                break
        if not sector_cell or is_grand_total_row(sector_cell):
            continue
        if month_cell and month_cell not in MONTH_KEYS and month_cell not in (
            "jan - dec",
            "year",
            "month",
        ):
            continue

        code, name = parse_sector_code_and_name(sector_cell)
        if not code and not name:
            continue
        if not code:
            code = (name.split()[0][:10] if name else "UNK").upper()

        total_col = 6 if len(row) > 6 else len(row) - 1
        total = cell_int(row[total_col]) or 0
        if total <= 0:
            continue

        month_key = month_cell[:3] if month_cell in MONTH_KEYS else None
        sector_labels[code] = name
        if month_key:
            sector_monthly[code][month_key] += total
        else:
            sector_monthly[code]["_annual"] += total

    sectors: list[SectorRow] = []
    for code, months in sector_monthly.items():
        permits: dict[str, Optional[int]] = {
            m: months.get(m) for m in MONTH_KEYS if m in months
        }
        if months.get("_annual") and not permits:
            grand_total = months["_annual"]
        else:
            grand_total = sum(permits.get(m) or 0 for m in MONTH_KEYS)
        sectors.append(
            SectorRow(
                sector_code=code,
                sector_name=sector_labels.get(code, code),
                permits=permits,
                grand_total=grand_total,
            )
        )
    return sectors


def parse_counties_file(path: Path) -> list[CountyRow]:
    rows = list(iter_sheet_rows(path))
    if not rows:
        return []

    header_idx = None
    county_col = 0
    issued_col = 1
    refused_col = 2

    for i, row in enumerate(rows[:20]):
        labels = [cell_str(c).lower() for c in row]
        if any("county" in x for x in labels):
            header_idx = i
            header = labels
            county_col = next((idx for idx, h in enumerate(header) if "county" in h), 0)
            issued_col = next((idx for idx, h in enumerate(header) if h == "issued"), 1)
            refused_col = next((idx for idx, h in enumerate(header) if h == "refused"), 2)
            break
        if "issued" in labels and "refused" in labels:
            # 2026-style: county name in column 0, no explicit County header
            header_idx = i
            issued_col = labels.index("issued")
            refused_col = labels.index("refused")
            county_col = 0
            break

    if header_idx is None:
        return []

    counties: list[CountyRow] = []
    for row in rows[header_idx + 1 :]:
        county = cell_str(row[county_col] if county_col < len(row) else "")
        if not county or is_grand_total_row(county):
            continue
        issued = cell_int(row[issued_col] if issued_col < len(row) else None) or 0
        refused = cell_int(row[refused_col] if refused_col < len(row) else None) or 0
        counties.append(CountyRow(county=county, issued=issued, refused=refused))
    return counties


# ─── Database ─────────────────────────────────────────────────────────────────


def db_connect():
    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "5432"))
    name = os.getenv("DB_NAME", os.getenv("DATABASE_NAME", "careerops"))
    user = os.getenv("DB_USER", os.getenv("DATABASE_USERNAME", "postgres"))
    password = os.getenv("DB_PASSWORD", os.getenv("DATABASE_PASSWORD", "admin"))
    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=name,
        user=user,
        password=password,
    )
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute("SET search_path TO careerops")
    return conn


def year_has_active_snapshot(conn, year: int) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM permit_snapshots
            WHERE source_year = %s AND is_active = true
            LIMIT 1
            """,
            (year,),
        )
        return cur.fetchone() is not None


def delete_year_snapshots(conn, year: int) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM permit_snapshots WHERE source_year = %s", (year,))


def deactivate_year_snapshots(conn, year: int) -> None:
    """Deactivate prior active snapshot; remove stale inactive rows to satisfy UNIQUE."""
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM permit_snapshots WHERE source_year = %s AND is_active = false",
            (year,),
        )
        cur.execute(
            """
            UPDATE permit_snapshots
            SET is_active = false
            WHERE source_year = %s AND is_active = true
            """,
            (year,),
        )


def insert_snapshot(
    conn,
    *,
    year: int,
    source_url: str,
    is_full_year: bool,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO permit_snapshots (
                source_year, is_full_year, source_url, is_active
            ) VALUES (%s, %s, %s, true)
            RETURNING id
            """,
            (year, is_full_year, source_url),
        )
        row = cur.fetchone()
        assert row is not None
        return int(row[0])


def bulk_insert_companies(
    conn,
    snapshot_id: int,
    year: int,
    companies: list[CompanyRow],
) -> None:
    sql = """
        INSERT INTO permit_companies (
            snapshot_id, source_year, employer_name, employer_name_normalised,
            permits_jan, permits_feb, permits_mar, permits_apr, permits_may, permits_jun,
            permits_jul, permits_aug, permits_sep, permits_oct, permits_nov, permits_dec,
            grand_total, status, momentum, rank_overall
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s
        )
    """
    tuples = [
        (
            snapshot_id,
            year,
            c.employer_name,
            c.employer_name_normalised,
            c.permits.get("jan"),
            c.permits.get("feb"),
            c.permits.get("mar"),
            c.permits.get("apr"),
            c.permits.get("may"),
            c.permits.get("jun"),
            c.permits.get("jul"),
            c.permits.get("aug"),
            c.permits.get("sep"),
            c.permits.get("oct"),
            c.permits.get("nov"),
            c.permits.get("dec"),
            c.grand_total,
            c.status,
            c.momentum,
            c.rank_overall,
        )
        for c in companies
    ]
    with conn.cursor() as cur:
        for i in range(0, len(tuples), BATCH_SIZE):
            psycopg2.extras.execute_batch(cur, sql, tuples[i : i + BATCH_SIZE])


def bulk_insert_sectors(
    conn,
    snapshot_id: int,
    year: int,
    sectors: list[SectorRow],
) -> None:
    sql = """
        INSERT INTO permit_sectors (
            snapshot_id, source_year, sector_code, sector_name,
            permits_jan, permits_feb, permits_mar, permits_apr, permits_may, permits_jun,
            permits_jul, permits_aug, permits_sep, permits_oct, permits_nov, permits_dec,
            grand_total
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s
        )
    """
    tuples = [
        (
            snapshot_id,
            year,
            s.sector_code,
            s.sector_name,
            s.permits.get("jan"),
            s.permits.get("feb"),
            s.permits.get("mar"),
            s.permits.get("apr"),
            s.permits.get("may"),
            s.permits.get("jun"),
            s.permits.get("jul"),
            s.permits.get("aug"),
            s.permits.get("sep"),
            s.permits.get("oct"),
            s.permits.get("nov"),
            s.permits.get("dec"),
            s.grand_total,
        )
        for s in sectors
    ]
    with conn.cursor() as cur:
        for i in range(0, len(tuples), BATCH_SIZE):
            psycopg2.extras.execute_batch(cur, sql, tuples[i : i + BATCH_SIZE])


def bulk_insert_counties(
    conn,
    snapshot_id: int,
    year: int,
    counties: list[CountyRow],
) -> None:
    sql = """
        INSERT INTO permit_counties (snapshot_id, source_year, county, issued, refused)
        VALUES (%s, %s, %s, %s, %s)
    """
    tuples = [
        (snapshot_id, year, c.county, c.issued, c.refused) for c in counties
    ]
    with conn.cursor() as cur:
        for i in range(0, len(tuples), BATCH_SIZE):
            psycopg2.extras.execute_batch(cur, sql, tuples[i : i + BATCH_SIZE])


def update_snapshot_counts(
    conn,
    snapshot_id: int,
    companies: int,
    sectors: int,
    counties: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE permit_snapshots
            SET row_count_companies = %s,
                row_count_sectors = %s,
                row_count_counties = %s
            WHERE id = %s
            """,
            (companies, sectors, counties, snapshot_id),
        )


# ─── Reliability rebuild ──────────────────────────────────────────────────────


def rebuild_company_year_history(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM company_year_history")
        cur.execute(
            """
            INSERT INTO company_year_history (
                employer_name_normalised, source_year, grand_total,
                rank_that_year, snapshot_id
            )
            SELECT pc.employer_name_normalised, pc.source_year, pc.grand_total,
                   pc.rank_overall, pc.snapshot_id
            FROM permit_companies pc
            INNER JOIN permit_snapshots ps ON ps.id = pc.snapshot_id
            WHERE ps.is_active = true
              AND pc.grand_total > 0
            """
        )


def _reliability_tier(score: float, years_active: int, last_seen_year: int, current_year: int) -> str:
    if years_active == 1 and last_seen_year >= current_year - 1:
        return "NEW"
    if score >= 90:
        return "ELITE"
    if score >= 75:
        return "STRONG"
    if score >= 55:
        return "CONSISTENT"
    if score >= 30:
        return "OCCASIONAL"
    return "INACTIVE"


def _volume_bonus(avg_annual: float) -> float:
    if avg_annual >= 500:
        return 20
    if avg_annual >= 200:
        return 15
    if avg_annual >= 100:
        return 10
    if avg_annual >= 50:
        return 7
    if avg_annual >= 20:
        return 4
    return 1


def _recency_bonus(last_seen_year: int, current_year: int) -> float:
    if last_seen_year == current_year:
        return 20
    if last_seen_year == current_year - 1:
        return 10
    if last_seen_year == current_year - 2:
        return 5
    return 0


def _trend_3yr(yearly: list[tuple[int, int]], live_years: set[int]) -> str:
    full = [(y, t) for y, t in yearly if y not in live_years]
    full.sort(key=lambda x: x[0])
    if len(full) < 2:
        return "INSUFFICIENT_DATA"
    last_three = full[-3:]
    if len(last_three) < 2:
        return "INSUFFICIENT_DATA"
    years = np.array([x[0] for x in last_three], dtype=float)
    totals = np.array([x[1] for x in last_three], dtype=float)
    slope = float(np.polyfit(years, totals, 1)[0])
    mean = float(np.mean(totals)) or 1.0
    if slope > 0.05 * mean:
        return "GROWING"
    if slope < -0.05 * mean:
        return "DECLINING"
    return "STABLE"


def _yoy_change(yearly: dict[int, int], live_years: set[int]) -> Optional[float]:
    full_years = sorted(y for y in yearly if y not in live_years)
    if len(full_years) < 2:
        return None
    last_year = full_years[-1]
    prev_year = full_years[-2]
    prev_total = yearly.get(prev_year)
    last_total = yearly.get(last_year)
    if not prev_total or prev_total == 0 or last_total is None:
        return None
    return round(((last_total - prev_total) / prev_total) * 100, 2)


def rebuild_reliability_scores(conn, current_year: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT employer_name_normalised, source_year, grand_total
            FROM company_year_history
            ORDER BY employer_name_normalised, source_year
            """
        )
        rows = cur.fetchall()

        cur.execute(
            """
            SELECT DISTINCT ON (pc.employer_name_normalised)
                   pc.employer_name_normalised, pc.employer_name
            FROM permit_companies pc
            INNER JOIN permit_snapshots ps ON ps.id = pc.snapshot_id
            WHERE ps.is_active = true
            ORDER BY pc.employer_name_normalised, pc.source_year DESC
            """
        )
        name_rows = cur.fetchall()

        cur.execute(
            "SELECT COUNT(DISTINCT source_year) FROM permit_snapshots WHERE is_active = true"
        )
        total_years_in_dataset = int(cur.fetchone()[0] or 0) or 1

    by_norm: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for norm, year, total in rows:
        by_norm[norm].append((int(year), int(total)))

    canonical: dict[str, str] = {}
    for norm, display in name_rows:
        if norm not in canonical:
            canonical[norm] = display

    upsert_sql = """
        INSERT INTO company_reliability_scores (
            employer_name_normalised, canonical_name, first_seen_year, last_seen_year,
            years_active, total_years_in_dataset, reliability_score, reliability_tier,
            total_permits_all_time, peak_year, peak_year_total, avg_annual_permits,
            trend_3yr, yoy_change_pct, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (employer_name_normalised) DO UPDATE SET
            canonical_name = EXCLUDED.canonical_name,
            first_seen_year = EXCLUDED.first_seen_year,
            last_seen_year = EXCLUDED.last_seen_year,
            years_active = EXCLUDED.years_active,
            total_years_in_dataset = EXCLUDED.total_years_in_dataset,
            reliability_score = EXCLUDED.reliability_score,
            reliability_tier = EXCLUDED.reliability_tier,
            total_permits_all_time = EXCLUDED.total_permits_all_time,
            peak_year = EXCLUDED.peak_year,
            peak_year_total = EXCLUDED.peak_year_total,
            avg_annual_permits = EXCLUDED.avg_annual_permits,
            trend_3yr = EXCLUDED.trend_3yr,
            yoy_change_pct = EXCLUDED.yoy_change_pct,
            updated_at = EXCLUDED.updated_at
    """

    now = datetime.now(timezone.utc)
    records: list[tuple] = []
    for norm, yearly_list in by_norm.items():
        active_years = [(y, t) for y, t in yearly_list if t > 0]
        if not active_years:
            continue
        years_active = len({y for y, t in active_years})
        first_seen = min(y for y, _ in active_years)
        last_seen = max(y for y, _ in active_years)
        yearly_map = {y: t for y, t in yearly_list}
        total_all = sum(t for _, t in active_years)
        avg_annual = total_all / years_active if years_active else 0
        peak_year, peak_total = max(active_years, key=lambda x: x[1])

        base = (years_active / total_years_in_dataset) * 60
        score = min(
            100.0,
            base
            + _recency_bonus(last_seen, current_year)
            + _volume_bonus(avg_annual),
        )
        tier = _reliability_tier(score, years_active, last_seen, current_year)
        trend = _trend_3yr(yearly_list, LIVE_YEARS)
        yoy = _yoy_change(yearly_map, LIVE_YEARS)

        records.append(
            (
                norm,
                canonical.get(norm, norm),
                first_seen,
                last_seen,
                years_active,
                total_years_in_dataset,
                round(score, 2),
                tier,
                total_all,
                peak_year,
                peak_total,
                round(avg_annual, 2),
                trend,
                yoy,
                now,
            )
        )

    with conn.cursor() as cur:
        for i in range(0, len(records), BATCH_SIZE):
            psycopg2.extras.execute_batch(cur, upsert_sql, records[i : i + BATCH_SIZE])

    return len(records)


def rebuild_scores(conn) -> int:
    log.info("Rebuilding company_year_history …")
    rebuild_company_year_history(conn)
    current_year = max(YEAR_SOURCES)
    log.info("Rebuilding company_reliability_scores (current_year=%s) …", current_year)
    return rebuild_reliability_scores(conn, current_year)


# ─── Per-year ingest ──────────────────────────────────────────────────────────


def ingest_year(
    conn: Any,
    year: int,
    *,
    force: bool,
    dry_run: bool,
) -> YearResult:
    result = YearResult(year=year)
    page_url = YEAR_SOURCES[year]

    if (
        not dry_run
        and conn is not None
        and not force
        and year_has_active_snapshot(conn, year)
    ):
        result.status = "SKIPPED"
        result.message = "active snapshot exists (use --force)"
        return result

    try:
        soup = fetch_page(page_url)
    except Exception as exc:
        result.status = "ERROR"
        result.message = f"page fetch failed: {exc}"
        log.error("Year %s: %s", year, result.message)
        return result

    links: dict[str, Optional[tuple[str, str]]] = {}
    for kind in ("companies", "sectors", "counties"):
        links[kind] = pick_spreadsheet_link(soup, kind=kind)
        if links[kind] is None:
            result.status = "ERROR"
            result.message = f"missing {kind} spreadsheet link"
            log.error("Year %s: %s", year, result.message)
            return result

    paths: dict[str, Path] = {}
    for kind, link in links.items():
        assert link is not None
        url, lower = link
        ext = ".xlsx" if lower.endswith(".xlsx") else ".xls"
        path = tmp_path(year, kind, ext)
        paths[kind] = path
        if should_skip_download(year, path, force):
            log.info("Year %s: using cached %s", year, path.name)
        else:
            log.info("Year %s: downloading %s", year, url)
            download_file(url, path)

    try:
        companies = parse_companies_file(paths["companies"], year)
        sectors = parse_sectors_file(paths["sectors"], year)
        counties = parse_counties_file(paths["counties"])
    except Exception as exc:
        result.status = "ERROR"
        result.message = f"parse failed: {exc}"
        log.exception("Year %s parse error", year)
        return result

    result.companies = len(companies)
    result.sectors = len(sectors)
    result.counties = len(counties)

    if dry_run:
        result.status = "DRY_RUN"
        result.message = "parsed OK (no DB write)"
        return result

    try:
        with conn:
            if force:
                delete_year_snapshots(conn, year)
            elif year_has_active_snapshot(conn, year):
                result.status = "SKIPPED"
                result.message = "active snapshot exists"
                return result
            else:
                deactivate_year_snapshots(conn, year)

            snapshot_id = insert_snapshot(
                conn,
                year=year,
                source_url=page_url,
                is_full_year=year in FULL_YEARS,
            )
            bulk_insert_companies(conn, snapshot_id, year, companies)
            bulk_insert_sectors(conn, snapshot_id, year, sectors)
            bulk_insert_counties(conn, snapshot_id, year, counties)
            update_snapshot_counts(
                conn,
                snapshot_id,
                len(companies),
                len(sectors),
                len(counties),
            )
        result.status = "OK"
        if year in LIVE_YEARS:
            result.message = "live"
    except Exception as exc:
        conn.rollback()
        result.status = "ERROR"
        result.message = str(exc)
        log.exception("Year %s DB error", year)

    return result


# ─── CLI ──────────────────────────────────────────────────────────────────────


def resolve_years(args: argparse.Namespace) -> list[int]:
    if args.all:
        return sorted(YEAR_SOURCES)
    if args.live_only:
        return sorted(LIVE_YEARS)
    if args.year is not None:
        return [args.year]
    if args.years:
        return sorted(set(args.years))
    return sorted(LIVE_YEARS)


def configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    out = logging.StreamHandler(sys.stdout)
    out.setLevel(logging.INFO)
    out.addFilter(lambda r: r.levelno < logging.ERROR)
    out.setFormatter(fmt)

    err = logging.StreamHandler(sys.stderr)
    err.setLevel(logging.ERROR)
    err.setFormatter(fmt)

    root.handlers.clear()
    root.addHandler(out)
    root.addHandler(err)


def print_summary(results: list[YearResult], scores_count: Optional[int]) -> None:
    print()
    print(f"  {'Year':<6} | {'Companies':>9} | {'Sectors':>7} | {'Counties':>8} | Status")
    print(f"  {'-'*6}-+-{'-'*9}-+-{'-'*7}-+-{'-'*8}-+-{'-'*20}")
    for r in results:
        label = r.status
        if r.status == "OK" and r.message == "live":
            label = "OK (live)"
        elif r.status == "OK":
            label = "OK"
        elif r.status == "SKIPPED":
            label = "SKIP"
        elif r.status == "DRY_RUN":
            label = "DRY"
        elif r.status == "ERROR":
            label = "ERR"
        else:
            label = r.status
        print(
            f"  {r.year:<6} | {r.companies:>9} | {r.sectors:>7} | {r.counties:>8} | {label}"
            + (f" - {r.message}" if r.message and r.status != "OK" else "")
        )
    print()
    if scores_count is not None:
        print(f"  Reliability scores rebuilt: {scores_count:,} companies scored")
        print()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Ingest enterprise.gov.ie employment permit statistics (2009–2026).",
    )
    parser.add_argument("--year", type=int, metavar="YYYY", help="Ingest a single year")
    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        metavar="YYYY",
        help="Ingest multiple specific years",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Ingest all years (2009–2026); first-time setup",
    )
    parser.add_argument(
        "--live-only",
        action="store_true",
        help="Ingest only live/partial year(s) (default: 2026)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-ingest even if an active snapshot already exists",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse files and print counts; do not write to the database",
    )
    parser.add_argument(
        "--rebuild-scores",
        action="store_true",
        help="Rebuild company_year_history and company_reliability_scores",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    configure_logging()
    parser = build_parser()
    args = parser.parse_args(argv)

    years = resolve_years(args)
    invalid = [y for y in years if y not in YEAR_SOURCES]
    if invalid:
        log.error("Unknown year(s): %s", invalid)
        return 2

    # Default when no year flags: live-only (2026)
    if not (args.all or args.live_only or args.year is not None or args.years):
        years = sorted(LIVE_YEARS)

    log.info(
        "Permit ingest starting — years=%s force=%s dry_run=%s rebuild_scores=%s",
        years,
        args.force,
        args.dry_run,
        args.rebuild_scores,
    )

    conn = None
    if not args.dry_run:
        try:
            conn = db_connect()
        except Exception as exc:
            log.error("Database connection failed: %s", exc)
            return 1

    results: list[YearResult] = []
    any_written = False

    try:
        for year in years:
            log.info("--- Year %s ---", year)
            yr_result = ingest_year(
                conn,
                year,
                force=args.force,
                dry_run=args.dry_run,
            )
            results.append(yr_result)
            if yr_result.status == "OK":
                any_written = True

        scores_count: Optional[int] = None
        should_rebuild = args.rebuild_scores or (
            any_written and not args.dry_run and len(years) > 0
        )
        if should_rebuild and conn is not None:
            try:
                with conn:
                    scores_count = rebuild_scores(conn)
                conn.commit()
            except Exception:
                conn.rollback()
                log.exception("Reliability rebuild failed")
                scores_count = None
    finally:
        if conn is not None:
            conn.close()

    print_summary(results, scores_count)
    errors = sum(1 for r in results if r.status == "ERROR")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
