import re

with open(r"c:\Users\84923\OneDrive\Máy tính\online-learning-web ( final e learn )\SmartLifeApp\src\components\VisualBoard.tsx", 'r', encoding='utf-8') as f:
    content = f.read()

effects = re.findall(r'useEffect\s*\(\s*\(\s*\)\s*=>\s*\{.*?\},\s*\[.*?\]\)', content, re.DOTALL)
print(f"Found {len(effects)} useEffects")
for idx, effect in enumerate(effects):
    print(f"\n--- Effect {idx+1} ---")
    print(effect[:400] + "...")
