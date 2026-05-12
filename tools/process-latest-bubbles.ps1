Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$temp = "D:\wechat\document\WeChat Files\wxid_9fjf6yfhal7l21\FileStorage\Temp"
$out = Join-Path $root "assets\new"
$srcOut = Join-Path $out "source"
New-Item -ItemType Directory -Force -Path $out, $srcOut | Out-Null

$bubbleFiles = @(
  "a5ce835f50c5cedf09e0428dfd562ad.jpg",
  "a30aeac8700a5d25d8cef7c44d48a54.jpg",
  "dcbdce008c2550fe7b3af0642efb09f.jpg",
  "b3598878532dd22c220c89c17e86d54.jpg",
  "90938effe4d933a8d14cf3157c05f53.jpg",
  "82a4ae247653d49decf4bd5007d7304.jpg",
  "846fda18d09ed43b9b0f630d4efdc9c.jpg",
  "b78a08e323fca69c12e8799a958f330.jpg"
)

function Is-BackgroundPixel([System.Drawing.Color]$c) {
  $max = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
  $min = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
  $neutral = ($max - $min) -lt 42
  $bright = $c.R -gt 216 -and $c.G -gt 216 -and $c.B -gt 216
  $checker = $neutral -and $c.R -gt 175 -and $c.G -gt 175 -and $c.B -gt 175
  return $bright -or $checker
}

function Find-ContentBounds([System.Drawing.Bitmap]$img) {
  $minX = $img.Width
  $minY = $img.Height
  $maxX = 0
  $maxY = 0
  $limitY = [Math]::Floor($img.Height * 0.9)
  $step = 6

  for ($y = 0; $y -lt $limitY; $y += $step) {
    for ($x = 0; $x -lt $img.Width; $x += $step) {
      $c = $img.GetPixel($x, $y)
      if (-not (Is-BackgroundPixel $c)) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -le $minX -or $maxY -le $minY) {
    return [System.Drawing.Rectangle]::new(0, 0, $img.Width, $img.Height)
  }

  return [System.Drawing.Rectangle]::new($minX, $minY, $maxX - $minX, $maxY - $minY)
}

function Save-CircleBubble($inputPath, $outputPath) {
  $src = [System.Drawing.Bitmap]::FromFile($inputPath)
  try {
    $bounds = Find-ContentBounds $src
    $size = [Math]::Ceiling([Math]::Max($bounds.Width, $bounds.Height) * 1.03)
    $cx = $bounds.X + $bounds.Width / 2
    $cy = $bounds.Y + $bounds.Height / 2
    $cropX = [Math]::Max(0, [Math]::Floor($cx - $size / 2))
    $cropY = [Math]::Max(0, [Math]::Floor($cy - $size / 2))
    if ($cropX + $size -gt $src.Width) { $cropX = [Math]::Max(0, $src.Width - $size) }
    if ($cropY + $size -gt $src.Height) { $cropY = [Math]::Max(0, $src.Height - $size) }
    $crop = [System.Drawing.Rectangle]::new([int]$cropX, [int]$cropY, [int][Math]::Min($size, $src.Width), [int][Math]::Min($size, $src.Height))

    $dst = [System.Drawing.Bitmap]::new(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $g = [System.Drawing.Graphics]::FromImage($dst)
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.Clear([System.Drawing.Color]::Transparent)
      $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
      $clip.AddEllipse(4, 4, 504, 504)
      $g.SetClip($clip)
      $g.DrawImage($src, [System.Drawing.Rectangle]::new(0, 0, 512, 512), $crop, [System.Drawing.GraphicsUnit]::Pixel)
      $g.ResetClip()
      $g.Dispose()
      $clip.Dispose()
      $dst.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      if ($dst) { $dst.Dispose() }
    }
  } finally {
    $src.Dispose()
  }
}

for ($i = 0; $i -lt $bubbleFiles.Count; $i++) {
  $input = Join-Path $temp $bubbleFiles[$i]
  if (-not (Test-Path -LiteralPath $input)) {
    throw "Missing image: $input"
  }
  Copy-Item -LiteralPath $input -Destination (Join-Path $srcOut $bubbleFiles[$i]) -Force
  Save-CircleBubble $input (Join-Path $out ("bubble-{0:D2}.png" -f ($i + 1)))
}

Write-Output "Processed latest bubble assets into $out"
