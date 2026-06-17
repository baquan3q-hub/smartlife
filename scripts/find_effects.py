import os
import re

src_dir = r"c:\Users\84923\OneDrive\Máy tính\online-learning-web ( final e learn )\SmartLifeApp\src"

print("Searching for useEffect and supabase calls in component files...")

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Find supabase calls
            supabase_calls = re.findall(r'supabase\s*\.\s*[a-zA-Z_0-9]+', content)
            # Find useEffect hooks
            use_effects = re.findall(r'useEffect\s*\(', content)
            
            if supabase_calls or use_effects:
                rel_path = os.path.relpath(filepath, src_dir)
                print(f"\nFile: {rel_path}")
                if use_effects:
                    print(f"  - Found {len(use_effects)} useEffect hook(s)")
                if supabase_calls:
                    print(f"  - Found {len(supabase_calls)} Supabase call(s): {set(supabase_calls)}")
