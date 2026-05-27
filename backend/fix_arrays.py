import os

directory = r'd:\Career\career-ops\backend\src\main\resources\db\migration'

for filename in os.listdir(directory):
    if filename.endswith(".sql"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace TEXT[] with TEXT ARRAY
        new_content = content.replace('TEXT[]', 'TEXT ARRAY')
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filename}")
print("Done.")
