Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$temp = "D:\wechat\document\WeChat Files\wxid_9fjf6yfhal7l21\FileStorage\Temp"
$out = Join-Path $root "assets\new"
$srcOut = Join-Path $out "source"
New-Item -ItemType Directory -Force -Path $out, $srcOut | Out-Null

$bubbleFiles = @(
  "ef1b943927a2151a521cb71de9fdf37.jpg",
  "e6a051112e452e2ab8788538b5ced1b.jpg",
  "0cba9148917f4bfe3694d333ec60110.jpg",
  "33519dae63064121111bec30bd7708f.jpg",
  "c2788392f4aaee407a189437135df94.jpg",
  "81475b2af55367f2c605109aca7fe0f.jpg",
  "c9a565a81e3acf65a3931425e1737bf.jpg",
  "1e30af7c34bb7b787cb8ec1f61bb925.jpg",
  "6454e94bd330e0015afa84f31956935.jpg",
  "e631195ae4f0044952fecfe6e67d5ce.jpg",
  "55c537942be71d1b3dfb4f5bcedfc26.jpg"
)
$mouthFile = "a15ad699f33a20b6b6089ed5830f9ab.jpg"
$backgroundFile = "864ed3b40988fa8cc80cfe221285dda.jpg"

function Is-BackgroundPixel([System.Drawing.Color]$c) {
  $max = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
  $min = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
  return ($c.R -gt 218 -and $c.G -gt 218 -and $c.B -gt 218 -and ($max - $min) -lt 44)
}

function Find-ContentBounds([System.Drawing.Bitmap]$img, [double]$maxYRatio) {
  $minX = $img.Width
  $minY = $img.Height
  $maxX = 0
  $maxY = 0
  $limitY = [Math]::Floor($img.Height * $maxYRatio)
  $step = 8

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
    $bounds = Find-ContentBounds $src 0.9
    $size = [Math]::Ceiling([Math]::Max($bounds.Width, $bounds.Height) * 1.1)
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

      for ($y = 0; $y -lt 512; $y++) {
        for ($x = 0; $x -lt 512; $x++) {
          $p = $dst.GetPixel($x, $y)
          if ($p.A -eq 0) { continue }
          $max = [Math]::Max($p.R, [Math]::Max($p.G, $p.B))
          $min = [Math]::Min($p.R, [Math]::Min($p.G, $p.B))
          $neutralBright = ($p.R -gt 226 -and $p.G -gt 226 -and $p.B -gt 226 -and ($max - $min) -lt 34)
          if ($neutralBright) {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
          } elseif ($p.R -gt 212 -and $p.G -gt 212 -and $p.B -gt 212 -and ($max - $min) -lt 46) {
            $alpha = [int]([Math]::Max(35, 255 - (($min - 212) * 8)))
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb([Math]::Min($p.A, $alpha), $p.R, $p.G, $p.B))
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

function Save-TransparentMouth($inputPath, $outputPath) {
  $src = [System.Drawing.Bitmap]::FromFile($inputPath)
  try {
    $bounds = Find-ContentBounds $src 0.94
    $pad = 30
    $cropX = [Math]::Max(0, $bounds.X - $pad)
    $cropY = [Math]::Max(0, $bounds.Y - $pad)
    $cropW = [Math]::Min($src.Width - $cropX, $bounds.Width + $pad * 2)
    $cropH = [Math]::Min($src.Height - $cropY, $bounds.Height + $pad * 2)
    $crop = [System.Drawing.Rectangle]::new([int]$cropX, [int]$cropY, [int]$cropW, [int]$cropH)
    $dstW = 560
    $dstH = 700
    $dst = [System.Drawing.Bitmap]::new($dstW, $dstH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $g = [System.Drawing.Graphics]::FromImage($dst)
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.Clear([System.Drawing.Color]::Transparent)
      $scale = [Math]::Min($dstW / $crop.Width, $dstH / $crop.Height)
      $drawW = [int]($crop.Width * $scale)
      $drawH = [int]($crop.Height * $scale)
      $drawX = [int](($dstW - $drawW) / 2)
      $drawY = [int](($dstH - $drawH) / 2)
      $g.DrawImage($src, [System.Drawing.Rectangle]::new($drawX, $drawY, $drawW, $drawH), $crop, [System.Drawing.GraphicsUnit]::Pixel)
      $g.Dispose()

      for ($y = 0; $y -lt $dstH; $y++) {
        for ($x = 0; $x -lt $dstW; $x++) {
          $p = $dst.GetPixel($x, $y)
          if ($p.A -eq 0) { continue }
          if (Is-BackgroundPixel $p) {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
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

for ($i = 0; $i -lt $bubbleFiles.Count; $i++) {
  $input = Join-Path $temp $bubbleFiles[$i]
  Copy-Item -LiteralPath $input -Destination (Join-Path $srcOut $bubbleFiles[$i]) -Force
  Save-CircleBubble $input (Join-Path $out ("bubble-{0:D2}.png" -f ($i + 1)))
}

$mouthInput = Join-Path $temp $mouthFile
Copy-Item -LiteralPath $mouthInput -Destination (Join-Path $srcOut $mouthFile) -Force
Save-TransparentMouth $mouthInput (Join-Path $out "harvester-mouth.png")

$backgroundInput = Join-Path $temp $backgroundFile
Copy-Item -LiteralPath $backgroundInput -Destination (Join-Path $srcOut $backgroundFile) -Force
Copy-Item -LiteralPath $backgroundInput -Destination (Join-Path $out "background.jpg") -Force

Write-Output "Processed new Bubblish assets into $out"
