with open(r"c:\Users\84923\OneDrive\Máy tính\online-learning-web ( final e learn )\SmartLifeApp\src\components\VisualBoard.tsx", 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Look for setState calls or variable references
states = ['countdowns', 'countups', 'habits', 'habitLogs', 'careerGoals', 'lifeGoals', 'positions', 'todayJournal', 'journalStreak']
for state in states:
    usages = len(re.findall(r'\b' + re.escape(state) + r'\b', content))
    print(f"Variable '{state}' is referenced {usages} times in VisualBoard.tsx")
