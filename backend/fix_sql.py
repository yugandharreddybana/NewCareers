import os
import re

directory = r"d:\Career\career-ops\backend\src\main\resources\db\migration"

for root, dirs, files in os.walk(directory):
    for filename in files:
        if filename.endswith(".sql"):
            filepath = os.path.join(root, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = re.sub(r'PRIMARY KEY\s+DEFAULT\s+gen_random_uuid\(\)', 'DEFAULT gen_random_uuid() PRIMARY KEY', content)
            
            if content != new_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed {filename}")

print("Done.")
