import re, json, sys, subprocess

result = subprocess.run([
    'curl', '-s', '-L', '--max-time', '15',
    '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'https://www.irishjobs.ie/ShowResults.aspx?Keywords=software+engineer&Location=1&Recruiter=Company&SortType=date'
], capture_output=True, text=True)

html = result.stdout
print(f"Page size: {len(html)} bytes")

# Find EVERY occurrence of job-like title patterns with context
for m in re.finditer(r'"title"\s*:\s*"([^"]{5,120})"', html):
    title = m.group(1)
    # Skip non-job titles (meta tags, page titles)
    skip_words = ['Search', 'IrishJobs', 'Jobs in', 'Hello', 'popular', 'Salary']
    if any(title.startswith(w) for w in skip_words):
        continue
    # Get surrounding 200 chars for company/location
    start = max(0, m.start() - 300)
    end = min(len(html), m.end() + 300)
    ctx = html[start:end]
    # Find company
    comp_m = re.search(r'"company"\s*:\s*"([^"]+)"', ctx)
    company = comp_m.group(1) if comp_m else '?'
    # Find location
    loc_m = re.search(r'"location"\s*:\s*"([^"]+)"', ctx)
    location = loc_m.group(1) if loc_m else '?'
    # Find URL
    url_m = re.search(r'"url"\s*:\s*"([^"]+)"', ctx)
    url = url_m.group(1) if url_m else '?'
    
    print(f"  [{company}] {title[:70]} | {location} | {url[:80]}")

# Also look for other patterns
print("\n--- Searching for script data blocks ---")
for m in re.finditer(r'<script[^>]*id="([^"]*)"[^>]*type="([^"]*)"', html):
    print(f"  Script block: id={m.group(1)}, type={m.group(2)}")

# Check for __NEXT_DATA__ or similar
print("\n--- Checking for common SSR data patterns ---")
for pattern in ['__NEXT_DATA__', '__NUXT__', 'window.__INITIAL_STATE__', 'window.__DATA__']:
    idx = html.find(pattern)
    if idx >= 0:
        print(f"  Found {pattern} at index {idx}")
