with open(r"c:\Users\84923\OneDrive\Máy tính\online-learning-web ( final e learn )\SmartLifeApp\src\components\VisualBoard.tsx", 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'useEffect\(\(\) => \{\s*if \(!userId\) return;\s*const fetchEvents = async \(\) => \{.*?\};\s*fetchEvents\(\);\s*\}, \[userId\]\);', content, re.DOTALL)
if match:
    print(match.group(0))
else:
    # Print lines around the match if not found exactly
    print("Not matched exactly. Printing lines containing fetchEvents:")
    lines = content.splitlines()
    for idx, line in enumerate(lines):
        if "fetchEvents" in line:
            for l in lines[max(0, idx-5):min(len(lines), idx+30)]:
                print(l)
            break
