Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\skbap\.gemini\antigravity\brain\cdf43c04-d870-43ef-8610-727ff08ec79d\.user_uploaded\media_1793289848695_4a834076.jpg'
$srcImg = [System.Drawing.Bitmap]::FromFile($srcPath)

# Bounding box is (272, 182) to (752, 666), center is (512, 424)
# Splash / Regular icon: 512x512 crop gives maximum sharpness & presence
$cropSizeAny = 512
$cropXAny = [int](512 - ($cropSizeAny / 2)) # 256
$cropYAny = [int](424 - ($cropSizeAny / 2)) # 168

# Maskable icon (Android safe zone): 640x640 crop
$cropSizeMask = 640
$cropXMask = [int](512 - ($cropSizeMask / 2)) # 192
$cropYMask = [int](424 - ($cropSizeMask / 2)) # 104

function Render-Crystal-Icon($destFile, $size, $cropX, $cropY, $cropSize) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Ultra-high quality bicubic interpolation & smoothing
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Clean pure white background
    $g.Clear([System.Drawing.Color]::White)
    
    $srcRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropSize, $cropSize
    $destRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    
    $g.DrawImage($srcImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    
    # Clean background JPEG compression haze along the outer margins (first and last 8% of frame)
    # where the logo doesn't reach, ensuring 100% pure #FFFFFF
    $margin = [int]($size * 0.08)
    for ($y = 0; $y -lt $size; $y++) {
        for ($x = 0; $x -lt $size; $x++) {
            if ($x -lt $margin -or $x -gt ($size - $margin) -or $y -lt $margin -or $y -gt ($size - $margin)) {
                $c = $bmp.GetPixel($x, $y)
                if ($c.R -gt 230 -and $c.G -gt 230 -and $c.B -gt 230) {
                    $bmp.SetPixel($x, $y, [System.Drawing.Color]::White)
                }
            }
        }
    }
    
    $dir = [System.IO.Path]::GetDirectoryName($destFile)
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    $bmp.Save($destFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $destFile ($size x $size)"
}

# 1. Generate 1024x1024 Ultra-HD Splash Screen Icons
Render-Crystal-Icon "icon-1024.png" 1024 $cropXAny $cropYAny $cropSizeAny
Render-Crystal-Icon "icons\icon-1024.png" 1024 $cropXAny $cropYAny $cropSizeAny

# 2. Generate 512x512 HD Icons
Render-Crystal-Icon "icon-512.png" 512 $cropXAny $cropYAny $cropSizeAny
Render-Crystal-Icon "icons\icon-512.png" 512 $cropXAny $cropYAny $cropSizeAny

# 3. Generate 512x512 Maskable Adaptive Icons
Render-Crystal-Icon "icon-maskable-512.png" 512 $cropXMask $cropYMask $cropSizeMask
Render-Crystal-Icon "icons\icon-maskable-512.png" 512 $cropXMask $cropYMask $cropSizeMask

# 4. Generate 192x192 Icons
Render-Crystal-Icon "icon-192.png" 192 $cropXAny $cropYAny $cropSizeAny
Render-Crystal-Icon "icons\icon-192.png" 192 $cropXAny $cropYAny $cropSizeAny

# 5. Generate 192x192 Maskable Icons
Render-Crystal-Icon "icon-maskable-192.png" 192 $cropXMask $cropYMask $cropSizeMask
Render-Crystal-Icon "icons\icon-maskable-192.png" 192 $cropXMask $cropYMask $cropSizeMask

# 6. Apple Touch & Favicon
Render-Crystal-Icon "apple-touch-icon.png" 180 $cropXAny $cropYAny $cropSizeAny
Render-Crystal-Icon "icons\apple-touch-icon.png" 180 $cropXAny $cropYAny $cropSizeAny

Render-Crystal-Icon "favicon.png" 64 $cropXAny $cropYAny $cropSizeAny
Render-Crystal-Icon "icons\favicon.png" 64 $cropXAny $cropYAny $cropSizeAny

$srcImg.Dispose()
Write-Host "All crystal-clear HD icons generated successfully!"
