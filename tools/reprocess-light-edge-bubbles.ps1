Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$temp = "D:\wechat\document\WeChat Files\wxid_9fjf6yfhal7l21\FileStorage\Temp"
$out = Join-Path $root "assets\new"
$srcOut = Join-Path $out "source"
New-Item -ItemType Directory -Force -Path $out, $srcOut | Out-Null

$bubbleMap = @(
  @{ File = "6ba7071da069aa2c817070552358474.jpg"; Out = "bubble-03.png" },
  @{ File = "4da0903916f12e81d885972137bd72a.jpg"; Out = "bubble-04.png" },
  @{ File = "58042244a6b9d4b881fbcef31c6de79.jpg"; Out = "bubble-08.png" },
  @{ File = "491e623992733fdf199e5b76cccb48f.jpg"; Out = "bubble-10.png" }
)

function Is-BackgroundPixel([System.Drawing.Color]$c) {
  $max = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
  $min = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
  return ($max - $min) -lt 46 -and $c.R -gt 168 -and $c.G -gt 168 -and $c.B -gt 168
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

function Save-LightEdgeBubble($inputPath, $outputPath) {
  $src = [System.Drawing.Bitmap]::FromFile($inputPath)
  try {
    $bounds = Find-ContentBounds $src
    $size = [Math]::Ceiling([Math]::Max($bounds.Width, $bounds.Height) * 1.0)
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
      $graphics = [System.Drawing.Graphics]::FromImage($dst)
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($src, [System.Drawing.Rectangle]::new(0, 0, $dstSize, $dstSize), $crop, [System.Drawing.GraphicsUnit]::Pixel)
      $graphics.Dispose()

      $center = ($dstSize - 1) / 2
      $radius = ($dstSize / 2) - 9
      $feather = 6.0
      for ($y = 0; $y -lt $dstSize; $y++) {
        for ($x = 0; $x -lt $dstSize; $x++) {
          $p = $dst.GetPixel($x, $y)
          if ($p.A -eq 0) { continue }

          $dx = $x - $center
          $dy = $y - $center
          $dist = [Math]::Sqrt($dx * $dx + $dy * $dy)
          if ($dist -gt $radius) {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
          } elseif ($dist -gt ($radius - $feather)) {
            $edge = ($radius - $dist) / $feather
            $alpha = [int]([Math]::Max(0, [Math]::Min(255, $p.A * $edge)))
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
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
  Save-LightEdgeBubble $input (Join-Path $out $item.Out)
}

Write-Output "Reprocessed light-edge bubbles into $out"
