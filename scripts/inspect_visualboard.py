with open(r"c:\Users\84923\OneDrive\Máy tính\online-learning-web ( final e learn )\SmartLifeApp\src\components\VisualBoard.tsx", 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Imports in VisualBoard.tsx:")
for line in lines[:40]:
    if "import" in line:
        print(line.strip())
