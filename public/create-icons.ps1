# PowerShell script to create placeholder PNG icons
$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)

Add-Type -AssemblyName System.Drawing

foreach ($size in $sizes) {
    $filename = "icons/icon-${size}x${size}.png"
    
    # Create bitmap
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Clear with blue background
    $g.Clear([System.Drawing.Color]::FromArgb(30, 64, 175))
    
    # Draw white rounded rectangle (document)
    $margin = [int]($size * 0.1875)
    $width = [int]($size * 0.625)
    $height = [int]($size * 0.5)
    $radius = [int]($size * 0.03125)
    
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 245, 245))
    $rect = New-Object System.Drawing.Rectangle($margin, $margin, $width, $height)
    $g.FillRectangle($brush, $rect)
    
    # Draw blue line
    $blueBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 64, 175))
    $lineRect = New-Object System.Drawing.Rectangle(
        [int]($margin + $size * 0.0625), 
        [int]($margin + $size * 0.0625), 
        [int]($size * 0.234), 
        [int]($size * 0.023)
    )
    $g.FillRectangle($blueBrush, $lineRect)
    
    # Draw green badge
    $greenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(5, 150, 105))
    $badgeWidth = [int]($size * 0.15)
    $badgeHeight = [int]($size * 0.047)
    $badgeX = [int]($margin + $size * 0.39)
    $badgeY = [int]($margin + $size * 0.36)
    $badgeRect = New-Object System.Drawing.Rectangle($badgeX, $badgeY, $badgeWidth, $badgeHeight)
    $g.FillRectangle($greenBrush, $badgeRect)
    
    # Save
    $bmp.Save((Join-Path $PSScriptRoot $filename), [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $bmp.Dispose()
    
    Write-Host "Created $filename"
}

Write-Host "`nAll icons created successfully!"
