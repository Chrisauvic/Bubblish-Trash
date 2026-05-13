Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$temp = "D:\wechat\document\WeChat Files\wxid_9fjf6yfhal7l21\FileStorage\Temp"
$out = Join-Path $root "assets\new"
$srcOut = Join-Path $out "source"
$coinFile = "a9898a530c336b23ec1ad94adc44612.jpg"
New-Item -ItemType Directory -Force -Path $out, $srcOut | Out-Null

function Is-BackgroundPixel([System.Drawing.Color]$c) {
  $max = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
  $min = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
  return ($max - $min) -lt 42 -and $c.R -gt 170 -and $c.G -gt 170 -and $c.B -gt 170
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

function Save-CircleAsset($inputPath, $outputPath) {
  $src = [System.Drawing.Bitmap]::FromFile($inputPath)
  try {
    $bounds = Find-ContentBounds $src
    $size = [Math]::Ceiling([Math]::Max($bounds.Width, $bounds.Height) * 1.04)
    $cx = $bounds.X + $bounds.Width / 2
    $cy = $bounds.Y + $bounds.Height / 2
    $cropX = [Math]::Max(0, [Math]::Floor($cx - $size / 2))
    $cropY = [Math]::Max(0, [Math]::Floor($cy - $size / 2))
    if ($cropX + $size -gt $src.Width) { $cropX = [Math]::Max(0, $src.Width - $size) }
    if ($cropY + $size -gt $src.Height) { $cropY = [Math]::Max(0, $src.Height - $size) }
    $crop = [System.Drawing.Rectangle]::new([int]$cropX, [int]$cropY, [int][Math]::Min($size, $src.Width), [int][Math]::Min($size, $src.Height))

    $dstSize = 768
    $dst = [System.Drawing.Bitmap]::new($dstSize, $dstSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $g = [System.Drawing.Graphics]::FromImage($dst)
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.Clear([System.Drawing.Color]::Transparent)
      $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
      $clip.AddEllipse(7, 7, $dstSize - 14, $dstSize - 14)
      $g.SetClip($clip)
      $g.DrawImage($src, [System.Drawing.Rectangle]::new(0, 0, $dstSize, $dstSize), $crop, [System.Drawing.GraphicsUnit]::Pixel)
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

$input = Join-Path $temp $coinFile
if (-not (Test-Path -LiteralPath $input)) {
  throw "Missing image: $input"
}
Copy-Item -LiteralPath $input -Destination (Join-Path $srcOut $coinFile) -Force
Save-CircleAsset $input (Join-Path $out "coin.png")
Write-Output "Processed coin asset into $out"
