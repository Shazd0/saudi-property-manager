Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$buildDir = Join-Path $projectRoot 'build'
$logoPath = Join-Path $projectRoot 'public\images\logo-512.png'

if (-not (Test-Path $logoPath)) {
    throw "Logo not found at $logoPath"
}

if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}

function New-GradientBitmap {
    param(
        [int]$Width,
        [int]$Height,
        [string]$OutputPath,
        [string]$Title,
        [string]$Subtitle,
        [bool]$Header = $false
    )

    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    $rect = New-Object System.Drawing.Rectangle 0, 0, $Width, $Height
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(8, 30, 54)), ([System.Drawing.Color]::FromArgb(16, 62, 92)), 40
    $gfx.FillRectangle($bgBrush, $rect)

    $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(65, 205, 171))
    if ($Header) {
        $gfx.FillRectangle($accentBrush, 0, 0, $Width, 5)
    } else {
        $gfx.FillRectangle($accentBrush, 0, 0, 8, $Height)
    }

    $overlayBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(38, 255, 255, 255))
    if (-not $Header) {
        $gfx.FillEllipse($overlayBrush, [int]($Width * 0.35), [int]($Height * 0.52), [int]($Width * 0.9), [int]($Height * 0.62))
    }

    $titleFontSize = if ($Header) { 13 } else { 14 }
    $subFontSize = if ($Header) { 8 } else { 9 }

    $titleFont = New-Object System.Drawing.Font 'Segoe UI Semibold', $titleFontSize, ([System.Drawing.FontStyle]::Bold)
    $subtitleFont = New-Object System.Drawing.Font 'Segoe UI', $subFontSize, ([System.Drawing.FontStyle]::Regular)
    $titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 248, 252))
    $subtitleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(207, 218, 230))

    if ($Header) {
        $gfx.DrawString($Title, $titleFont, $titleBrush, 12, 14)
        $gfx.DrawString($Subtitle, $subtitleFont, $subtitleBrush, 12, 34)
    } else {
        $gfx.DrawString($Title, $titleFont, $titleBrush, 16, 205)
        $gfx.DrawString($Subtitle, $subtitleFont, $subtitleBrush, 16, 232)
    }

    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

    $subtitleBrush.Dispose()
    $titleBrush.Dispose()
    $subtitleFont.Dispose()
    $titleFont.Dispose()
    $overlayBrush.Dispose()
    $accentBrush.Dispose()
    $bgBrush.Dispose()
    $gfx.Dispose()
    $bmp.Dispose()
}

function New-AppIcon {
    param(
        [string]$SourcePng,
        [string]$OutputIco
    )

    $source = [System.Drawing.Image]::FromFile($SourcePng)
    $iconBitmap = New-Object System.Drawing.Bitmap 256, 256
    $gfx = [System.Drawing.Graphics]::FromImage($iconBitmap)
    $gfx.Clear([System.Drawing.Color]::FromArgb(10, 26, 45))
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $logoRect = New-Object System.Drawing.Rectangle 36, 36, 184, 184
    $gfx.DrawImage($source, $logoRect)

    $hIcon = $iconBitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)

    $fs = [System.IO.File]::Open($OutputIco, [System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()

    $gfx.Dispose()
    $iconBitmap.Dispose()
    $source.Dispose()
}

New-AppIcon -SourcePng $logoPath -OutputIco (Join-Path $buildDir 'icon.ico')

New-GradientBitmap -Width 164 -Height 314 -OutputPath (Join-Path $buildDir 'installerSidebar.bmp') -Title 'Amlak Property Manager' -Subtitle 'Install the modern property operations suite.'
New-GradientBitmap -Width 164 -Height 314 -OutputPath (Join-Path $buildDir 'uninstallerSidebar.bmp') -Title 'Amlak Property Manager' -Subtitle 'Clean uninstall with preserved user data options.'
New-GradientBitmap -Width 150 -Height 57 -OutputPath (Join-Path $buildDir 'installerHeader.bmp') -Title 'Amlak Setup' -Subtitle 'Desktop Edition' -Header $true

Write-Output "Generated branding assets in $buildDir"
