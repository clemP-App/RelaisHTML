$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $PSScriptRoot | Out-Null
Add-Type -AssemblyName System.Drawing
$s = 512
$bmp = New-Object System.Drawing.Bitmap $s, $s
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(37, 99, 235))
$fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
$font = New-Object System.Drawing.Font $fontFamily, 72, 1, 2
$brush = [System.Drawing.Brushes]::White
$g.DrawString("EPS", $font, $brush, 140, 200)
$path512 = Join-Path $PSScriptRoot "icon-512.png"
$bmp.Save($path512, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp192 = New-Object System.Drawing.Bitmap 192, 192
$g2 = [System.Drawing.Graphics]::FromImage($bmp192)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bmp, 0, 0, 192, 192)
$path192 = Join-Path $PSScriptRoot "icon-192.png"
$bmp192.Save($path192, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$g2.Dispose()
$bmp.Dispose()
$bmp192.Dispose()
Write-Host "Wrote $path192 and $path512"
