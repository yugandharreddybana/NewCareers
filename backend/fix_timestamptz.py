import os
import re

directory = r'd:\Career\career-ops\backend\src\main\resources\db\migration'

# Regex to match TIMESTAMPTZ (case insensitive) as a whole word
pattern = re.compile(r'\bTIMESTAMPTZ\b', re.IGNORECASE)

for filename in os.listdir(directory):
    if filename.endswith(".sql"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace with TIMESTAMP WITH TIME ZONE
        new_content = pattern.sub('TIMESTAMP WITH TIME ZONE', content)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filename}")
print("Done.")
