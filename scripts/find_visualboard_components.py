import re

with open(r"c:\Users\84923\OneDrive\Máy tính\online-learning-web ( final e learn )\SmartLifeApp\src\components\VisualBoard.tsx", 'r', encoding='utf-8') as f:
    content = f.read()

# Find tags starting with capital letters
tags = set(re.findall(r'<([A-Z][a-zA-Z0-9]*)\b', content))
print("JSX Components used in VisualBoard.tsx:")
print(tags)
