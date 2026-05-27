import os
import re

directory = r'd:\Career\career-ops\backend\src\main\resources\db\migration'

for filename in os.listdir(directory):
    if filename.endswith(".sql"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace INTERVAL 'X days' -> INTERVAL 'X' DAY
        new_content = re.sub(r"INTERVAL\s+'(\d+)\s+days?'", r"INTERVAL '\1' DAY", content, flags=re.IGNORECASE)
        # Replace INTERVAL 'X minutes' -> INTERVAL 'X' MINUTE
        new_content = re.sub(r"INTERVAL\s+'(\d+)\s+minutes?'", r"INTERVAL '\1' MINUTE", new_content, flags=re.IGNORECASE)
        # Replace INTERVAL 'X year' -> INTERVAL 'X' YEAR
        new_content = re.sub(r"INTERVAL\s+'(\d+)\s+years?'", r"INTERVAL '\1' YEAR", new_content, flags=re.IGNORECASE)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filename}")
print("Done.")
