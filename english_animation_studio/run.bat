@echo off
chcp 65001 >nul
echo ====================================================
echo   ENGLISH ANIMATION STUDIO - BỘ CÔNG CỤ TỰ ĐỘNG
echo ====================================================
echo.
echo 1. Đang tạo Audio đa nhân vật và Phụ đề song ngữ...
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%~dp0generator.py"
if %errorlevel% neq 0 (
    echo [ERROR] Tạo audio thất bại!
    pause
    exit /b %errorlevel%
)
echo.
echo 2. Đang tạo các thẻ bài học đồ họa HD...
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%~dp0build_educational_cards.py"
echo.
echo 3. Đang xuất bản Video MP4 1080p Full HD hoàn chỉnh...
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%~dp0render_video.py"
if %errorlevel% neq 0 (
    echo [ERROR] Xuất video thất bại!
    pause
    exit /b %errorlevel%
)
echo.
echo ====================================================
echo   HOÀN THÀNH XUẤT BẢN VIDEO!
echo ====================================================
pause
