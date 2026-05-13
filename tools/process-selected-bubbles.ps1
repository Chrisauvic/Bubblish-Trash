Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$temp = "D:\wechat\document\WeChat Files\wxid_9fjf6yfhal7l21\FileStorage\Temp"
$out = Join-Path $root "assets\new"
$srcOut = Join-Path $out "source"
New-Item -ItemType Directory -Force -Path $out, $srcOut | Out-Null

$bubbleMap = @(
  @{ File = "f0027c2df8890930dbd9c7a0642da3b.jpg"; Out = "bubble-03.png" },
  @{ File = "01f7341c9fe15593fac377bea38996e.jpg"; Out = "bubble-04.png" },
  @{ File = "04d1553b8ef003bf58da38a488d7b99.jpg"; Out = "bubble-07.png" },
  @{ File = "c71c6a64f1857fd1c7814a4a7059deb.jpg"; Out = "bubble-08.png" },
  @{ File = "82e6c70fce0a0c430701f8947481a51.jpg"; Out = "bubble-09.png" },
  @{ File = "3b63dc21e29b1691b24208250f172a5.jpg"; Out = "bubble-10.png" }
)

function Is-BackgroundPixel([System.Drawing.Color]$c) {
  $max = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
  $min = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
  $neutral = ($max - $min) -lt 44
  return $neutral -and $c.R -gt 168 -and $c.G -gt 168 -and $c.B -gt 168
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

function Save-SoftCircleBubble($inputPath, $outputPath) {
  $src = [System.Drawing.Bitmap]::FromFile($inputPath)
  try {
    $bounds = Find-ContentBounds $src
    $size = [Math]::Ceiling([Math]::Max($bounds.Width, $bounds.Height) * 0.985)
    $cx = $bounds.X + $bounds.Width / 2
    $cy = $bounds.Y + $bounds.Height / 2
    $cropX = [Math]::Max(0, [Math]::Floor($cx - $size / 2))
    $cropY = [Math]::Max(0, [Math]::Floor($cy - $size / 2))
    if ($cropX + $size -gt $src.Width) { $cropX = [Math]::Max(0, $src.Width - $size) }
    if ($cropY + $size -gt $src.Height) { $cropY = [Math]::Max(0, $src.Height - $size) }
    $crop = [System.Drawing.Rectangle]::new([int]$cropX, [int]$cropY, [int][Math]::Min($size, $src.Width), [int][Math]::Min($size, $src.Height))

    $dstSize = 1024
    $dst = [System.Drawing.Bitmap]::new($dstSize, $dstSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $g = [System.Drawing.Graphics]::FromImage($dst)
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.Clear([System.Drawing.Color]::Transparent)
      $g.DrawImage($src, [System.Drawing.Rectangle]::new(0, 0, $dstSize, $dstSize), $crop, [System.Drawing.GraphicsUnit]::Pixel)
      $g.Dispose()

      $center = ($dstSize - 1) / 2
      $radius = ($dstSize / 2) - 13
      $fadeStart = $radius - 18
      $outerSoft = 9.0
      for ($y = 0; $y -lt $dstSize; $y++) {
        for ($x = 0; $x -lt $dstSize; $x++) {
          $p = $dst.GetPixel($x, $y)
          if ($p.A -eq 0) { continue }
          $dx = $x - $center
          $dy = $y - $center
          $dist = [Math]::Sqrt($dx * $dx + $dy * $dy)
          if ($dist -gt $radius) {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
            continue
          }

          $r = $p.R
          $gch = $p.G
          $b = $p.B
          if ($dist -gt $fadeStart) {
            $edge = ($radius - $dist) / ($radius - $fadeStart)
            $alpha = [int]([Math]::Max(0, [Math]::Min(255, $p.A * $edge)))
            $r = [int]($r + (255 - $r) * 0.28)
            $gch = [int]($gch + (255 - $gch) * 0.28)
            $b = [int]($b + (255 - $b) * 0.28)
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $r, $gch, $b))
          } elseif ($dist -gt ($fadeStart - $outerSoft)) {
            $mix = ($dist - ($fadeStart - $outerSoft)) / $outerSoft
            $r = [int]($r + (255 - $r) * 0.18 * $mix)
            $gch = [int]($gch + (255 - $gch) * 0.18 * $mix)
            $b = [int]($b + (255 - $b) * 0.18 * $mix)
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, $r, $gch, $b))
          }
        }
      }
      $dst.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      if ($dst) { $dst.Dispose() }
    }
  } finally {
    $src.Dispose()
  }
}

foreach ($item in $bubbleMap) {
  $input = Join-Path $temp $item.File
  if (-not (Test-Path -LiteralPath $input)) {
    throw "Missing image: $input"
  }
  Copy-Item -LiteralPath $input -Destination (Join-Path $srcOut $item.File) -Force
  Save-SoftCircleBubble $input (Join-Path $out $item.Out)
}

Write-Output "Processed selected bubbles into $out"
