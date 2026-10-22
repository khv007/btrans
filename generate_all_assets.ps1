Add-Type -AssemblyName System.Drawing

$sourcePath = "D:\Loyihalar\Maoshni taqsimlash\logo-source.jpg"
$logoSource = [System.Drawing.Bitmap]::FromFile($sourcePath)

# -------------------------------------------------------------
# 1. GENERATE APPLE TOUCH ICON (180x180)
# -------------------------------------------------------------
Write-Output "Generating apple-touch-icon.png (180x180)..."
$appleIcon = [System.Drawing.Bitmap]::new(180, 180)
$gApple = [System.Drawing.Graphics]::FromImage($appleIcon)
$gApple.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gApple.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gApple.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Fill background with logo background color #D9D9D9
$gApple.Clear([System.Drawing.Color]::FromArgb(217, 217, 217))
# Draw full logo
$gApple.DrawImage($logoSource, 0, 0, 180, 180)
$gApple.Dispose()
$appleIcon.Save("D:\Loyihalar\Maoshni taqsimlash\apple-touch-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$appleIcon.Dispose()

# -------------------------------------------------------------
# 2. GENERATE ANDROID CHROME ICONS (192x192 and 512x512)
# -------------------------------------------------------------
Write-Output "Generating android-chrome-192x192.png and 512x512.png..."
foreach ($size in @(192, 512)) {
    $androidIcon = [System.Drawing.Bitmap]::new($size, $size)
    $gAndroid = [System.Drawing.Graphics]::FromImage($androidIcon)
    $gAndroid.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gAndroid.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gAndroid.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gAndroid.Clear([System.Drawing.Color]::FromArgb(217, 217, 217))
    $gAndroid.DrawImage($logoSource, 0, 0, $size, $size)
    $gAndroid.Dispose()
    $androidIcon.Save("D:\Loyihalar\Maoshni taqsimlash\android-chrome-$($size)x$($size).png", [System.Drawing.Imaging.ImageFormat]::Png)
    $androidIcon.Dispose()
}

# -------------------------------------------------------------
# 3. GENERATE FAVICONS (32x32, 16x16, favicon.ico)
# Focused tightly on the BT monogram for razor-sharp legibility
# -------------------------------------------------------------
Write-Output "Generating crisp favicons (32x32, 16x16, favicon.ico)..."
# Crop rectangle for BT monogram (X:172, Y:136, W:290, H:290)
$cropRect = [System.Drawing.Rectangle]::new(172, 136, 290, 290)

foreach ($size in @(32, 16)) {
    $favBmp = [System.Drawing.Bitmap]::new($size, $size)
    $gFav = [System.Drawing.Graphics]::FromImage($favBmp)
    $gFav.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gFav.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gFav.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gFav.Clear([System.Drawing.Color]::FromArgb(217, 217, 217))
    
    # Destination rectangle with 1px padding for nice breathing room
    $destRect = [System.Drawing.Rectangle]::new(1, 1, $size - 2, $size - 2)
    $gFav.DrawImage($logoSource, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
    $gFav.Dispose()

    $favBmp.Save("D:\Loyihalar\Maoshni taqsimlash\favicon-$($size)x$($size).png", [System.Drawing.Imaging.ImageFormat]::Png)
    
    if ($size -eq 32) {
        # Create favicon.ico from 32x32
        $hIcon = $favBmp.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($hIcon)
        $fs = [System.IO.FileStream]::new("D:\Loyihalar\Maoshni taqsimlash\favicon.ico", [System.IO.FileMode]::Create)
        $icon.Save($fs)
        $fs.Close()
    }
    $favBmp.Dispose()
}

# -------------------------------------------------------------
# 4. GENERATE OPEN GRAPH PREVIEW (1200x630)
# Executive modern card design
# -------------------------------------------------------------
Write-Output "Generating preview.png (1200x630 Open Graph banner)..."
$preview = [System.Drawing.Bitmap]::new(1200, 630)
$g = [System.Drawing.Graphics]::FromImage($preview)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Helper function for rounded rectangles
function Draw-RoundedRectangle($graphics, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
    $path.AddArc($x + $w - ($r * 2), $y, $r * 2, $r * 2, 270, 90)
    $path.AddArc($x + $w - ($r * 2), $y + $h - ($r * 2), $r * 2, $r * 2, 0, 90)
    $path.AddArc($x, $y + $h - ($r * 2), $r * 2, $r * 2, 90, 90)
    $path.CloseFigure()
    $graphics.DrawPath($pen, $path)
    $path.Dispose()
}

function Fill-RoundedRectangle($graphics, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
    $path.AddArc($x + $w - ($r * 2), $y, $r * 2, $r * 2, 270, 90)
    $path.AddArc($x + $w - ($r * 2), $y + $h - ($r * 2), $r * 2, $r * 2, 0, 90)
    $path.AddArc($x, $y + $h - ($r * 2), $r * 2, $r * 2, 90, 90)
    $path.CloseFigure()
    $graphics.FillPath($brush, $path)
    $path.Dispose()
}

# --- Canvas Background: Deep Navy Slate gradient ---
$bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new(1200, 630),
    [System.Drawing.Color]::FromArgb(11, 15, 25),    # #0b0f19
    [System.Drawing.Color]::FromArgb(23, 27, 48)     # #171b30
)
$g.FillRectangle($bgBrush, 0, 0, 1200, 630)
$bgBrush.Dispose()

# Ambient glow circle (top right)
$glowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(28, 79, 70, 229)) # #4f46e5 with alpha
$g.FillEllipse($glowBrush, 750, -100, 500, 500)
$glowBrush.Dispose()

# Ambient glow circle (bottom left)
$glowBrush2 = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(20, 16, 185, 129)) # #10b981 with alpha
$g.FillEllipse($glowBrush2, -100, 350, 450, 450)
$glowBrush2.Dispose()

# --- Central Card (Glassmorphism effect) ---
$cardX = 75
$cardY = 65
$cardW = 1050
$cardH = 500
$cardR = 26

$cardBg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(230, 17, 24, 39)) # #111827 with high opacity
Fill-RoundedRectangle $g $cardBg $cardX $cardY $cardW $cardH $cardR
$cardBg.Dispose()

$cardBorder = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(80, 99, 102, 241), 1.8) # indigo border
Draw-RoundedRectangle $g $cardBorder $cardX $cardY $cardW $cardH $cardR
$cardBorder.Dispose()

# --- Left Column: Logo Container ---
$logoBoxX = $cardX + 50
$logoBoxY = $cardY + 70
$logoBoxSize = 360
$logoBoxR = 20

# White/Light container for logo
$logoContainerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(217, 217, 217))
Fill-RoundedRectangle $g $logoContainerBrush $logoBoxX $logoBoxY $logoBoxSize $logoBoxSize $logoBoxR
$logoContainerBrush.Dispose()

$logoBorder = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 255), 2.5)
Draw-RoundedRectangle $g $logoBorder $logoBoxX $logoBoxY $logoBoxSize $logoBoxSize $logoBoxR
$logoBorder.Dispose()

# Draw the Bourkhan Trans logo inside container with smooth margin
$logoDestRect = [System.Drawing.Rectangle]::new($logoBoxX + 15, $logoBoxY + 15, $logoBoxSize - 30, $logoBoxSize - 30)
$g.DrawImage($logoSource, $logoDestRect)

# --- Right Column: Branding & Typography ---
$textStartX = $cardX + 460
$textY = $cardY + 80

# 1. Company Brand Tag / Badge
$badgeBg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(40, 79, 70, 229))
Fill-RoundedRectangle $g $badgeBg $textStartX $textY 380 38 10
$badgeBg.Dispose()

$badgeBorder = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 99, 102, 241), 1.2)
Draw-RoundedRectangle $g $badgeBorder $textStartX $textY 380 38 10
$badgeBorder.Dispose()

# Dot inside badge
$dotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(16, 185, 129)) # Emerald green dot
$g.FillEllipse($dotBrush, ($textStartX + 16), ($textY + 13), 11, 11)
$dotBrush.Dispose()

$tagFont = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$tagBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(199, 210, 254))
$g.DrawString("BOURKHAN TRANS LOGISTICS", $tagFont, $tagBrush, ($textStartX + 36), ($textY + 9))
$tagFont.Dispose()
$tagBrush.Dispose()

# 2. Main Title: "BOURKHAN TRANS"
$titleFont = [System.Drawing.Font]::new("Segoe UI", 44, [System.Drawing.FontStyle]::Bold)
$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$g.DrawString("BOURKHAN TRANS", $titleFont, $titleBrush, ($textStartX - 4), ($textY + 54))
$titleFont.Dispose()
$titleBrush.Dispose()

# 3. Subtitle: "Haydovchilar & Reyslar Ekotizimi"
$subFont = [System.Drawing.Font]::new("Segoe UI", 21, [System.Drawing.FontStyle]::Regular)
$subBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(148, 163, 184)) # #94a3b8
$g.DrawString("Haydovchilar & Reyslar Ekotizimi", $subFont, $subBrush, $textStartX, ($textY + 145))
$subFont.Dispose()
$subBrush.Dispose()

# 4. Feature Pills
$pillY = $textY + 210
$pills = @("Kunlik Davomat", "Maosh & Avans", "Eksport Excel", "Mobil / Web")
$currentPillX = $textStartX
$pillFont = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)

foreach ($pill in $pills) {
    $measure = $g.MeasureString($pill, $pillFont)
    $pWidth = [int]$measure.Width + 26
    $pHeight = 34
    
    $pBg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(25, 255, 255, 255))
    Fill-RoundedRectangle $g $pBg $currentPillX $pillY $pWidth $pHeight 8
    $pBg.Dispose()
    
    $pBorder = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(50, 255, 255, 255), 1)
    Draw-RoundedRectangle $g $pBorder $currentPillX $pillY $pWidth $pHeight 8
    $pBorder.Dispose()
    
    $pBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(226, 232, 240))
    $g.DrawString($pill, $pillFont, $pBrush, ($currentPillX + 13), ($pillY + 7))
    $pBrush.Dispose()
    
    $currentPillX += ($pWidth + 12)
}
$pillFont.Dispose()

# 5. Website domain footer
$domainY = $textY + 285
$domainFont = [System.Drawing.Font]::new("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$domainBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(99, 102, 241)) # Primary Indigo
$g.DrawString("bourkhantrans.uz", $domainFont, $domainBrush, $textStartX, $domainY)
$domainFont.Dispose()
$domainBrush.Dispose()

$verifiedFont = [System.Drawing.Font]::new("Segoe UI", 14, [System.Drawing.FontStyle]::Regular)
$verifiedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(100, 116, 139))
$g.DrawString("- Rasmiy korporativ boshqaruv portali", $verifiedFont, $verifiedBrush, ($textStartX + 185), ($domainY + 2))
$verifiedFont.Dispose()
$verifiedBrush.Dispose()

# Save preview.png
$g.Dispose()
$preview.Save("D:\Loyihalar\Maoshni taqsimlash\preview.png", [System.Drawing.Imaging.ImageFormat]::Png)
$preview.Dispose()
$logoSource.Dispose()

Write-Output "ALL ASSETS GENERATED SUCCESSFULLY ON D: DRIVE!"
