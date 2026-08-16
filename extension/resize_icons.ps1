# File: extension/resize_icons.ps1
Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\public\pwa-192x192.png"
$destDir = Join-Path $PSScriptRoot "icons"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$srcImage = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath))

function Resize-ImageFile {
    param(
        [System.Drawing.Image]$img,
        [int]$width,
        [int]$height,
        [string]$targetPath
    )
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graph.DrawImage($img, 0, 0, $width, $height)
    
    if (Test-Path $targetPath) {
        Remove-Item -Path $targetPath -Force
    }
    
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $bmp.Dispose()
}

Resize-ImageFile -img $srcImage -width 16 -height 16 -targetPath (Join-Path $destDir "icon16.png")
Resize-ImageFile -img $srcImage -width 48 -height 48 -targetPath (Join-Path $destDir "icon48.png")
Resize-ImageFile -img $srcImage -width 128 -height 128 -targetPath (Join-Path $destDir "icon128.png")

$srcImage.Dispose()
Write-Host "✅ Created icon16.png, icon48.png, icon128.png from official SmartLife logo!"
