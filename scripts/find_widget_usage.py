import os

src_dir = r"c:\Users\84923\OneDrive\Máy tính\online-learning-web ( final e learn )\SmartLifeApp\src"
widgets = ["BookmarkWidget", "HabitsWidget", "QuickNotesWidget"]

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            for widget in widgets:
                if widget in content and not file.startswith(widget):
                    print(f"Widget {widget} is used in {os.path.relpath(filepath, src_dir)}")
