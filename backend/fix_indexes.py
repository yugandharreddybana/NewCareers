import os
import re

directory = r'd:\Career\career-ops\backend\src\main\resources\db\migration'

# Match CREATE INDEX up to just before the WHERE clause, ignoring everything after WHERE up to the semicolon
pattern = re.compile(r'(CREATE\s+(?:UNIQUE\s+)?INDEX\s+[\s\S]*?)\s+WHERE\s+[^;]+;', re.IGNORECASE)

for filename in os.listdir(directory):
    if filename.endswith(".sql"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = pattern.sub(r'\1;', content)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filename}")
print("Done.")
