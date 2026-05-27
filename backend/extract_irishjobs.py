import re, json, sys
from pathlib import Path

# First, fetch the page
import subprocess
result = subprocess.run([
    'curl', '-s', '-L', '--max-time', '15',
    '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'https://www.irishjobs.ie/ShowResults.aspx?Keywords=software+engineer&Location=1&Recruiter=Company&SortType=date'
], capture_output=True, text=True)

html = result.stdout
print(f"Page size: {len(html)} bytes")
if len(html) < 1000:
    print("ERROR: Page too small, likely blocked")
    print(html[:500])
    sys.exit(1)

# Find the PRELOADED_STATE
idx = html.find('window.__PRELOADED_STATE__')
print(f"Found __PRELOADED_STATE__ at index: {idx}")

chunk = html[idx:]
eq = chunk.find('=')
brace_start = chunk.find('{', eq)
depth = 0
i = brace_start
while i < len(chunk):
    if chunk[i] == '{': depth += 1
    elif chunk[i] == '}':
        depth -= 1
        if depth == 0:
            break
    i += 1

json_str = chunk[brace_start:i+1]
print(f"JSON string length: {len(json_str)}")

try:
    data = json.loads(json_str)
except json.JSONDecodeError as e:
    print(f"JSON parse error: {e}")
    # Try alternative: just extract job titles/companies from JSON fragments
    titles = re.findall(r'"title"\s*:\s*"([^"]+)"', html[:300000])
    companies = re.findall(r'"company"\s*:\s*"([^"]+)"', html[:300000])
    locations = re.findall(r'"location"\s*:\s*"([^"]+)"', html[:300000])
    urls = re.findall(r'"url"\s*:\s*"([^"]+)"', html[:300000])
    print(f"Raw title fields: {len(titles)}")
    print(f"Raw company fields: {len(companies)}")
    print(f"Raw location fields: {len(locations)}")
    print(f"Raw url fields: {len(urls)}")
    for t in titles[:25]:
        print(f"  Title: {t}")
    sys.exit(0)

# Explore the data
keys = list(data.keys()) if isinstance(data, dict) else []
print(f"Top-level keys ({len(keys)}): {keys}")

def find_job_lists(obj, path="", depth=0):
    if depth > 7:
        return
    if isinstance(obj, dict):
        if 'title' in obj:
            print(f"  JOB at {path}: {obj.get('title','?')[:80]} | {obj.get('company','?')}")
            return
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                find_job_lists(v, f"{path}.{k}", depth+1)
    elif isinstance(obj, list) and len(obj) > 0:
        if isinstance(obj[0], dict):
            sample_keys = list(obj[0].keys())
            if len(obj) > 3:
                print(f"  LIST at {path}: len={len(obj)}, keys={sample_keys[:12]}")
            else:
                print(f"  LIST at {path}: len={len(obj)}, keys={sample_keys}")
            if 'title' in sample_keys:
                for item in obj[:5]:
                    print(f"    -> {item.get('title','?')[:80]} | {item.get('company','?')}")

find_job_lists(data)
