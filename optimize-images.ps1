# Install WebP converter if not exists
if (-not (Get-Command cwebp -ErrorAction SilentlyContinue)) {
    Write-Host "Please install WebP converter from: https://developers.google.com/speed/webp/download"
    exit
}

# Create optimized directory if not exists
$optimizedDir = "$PSScriptRoot\assets\images-optimized"
if (-not (Test-Path $optimizedDir)) {
    New-Item -ItemType Directory -Path $optimizedDir | Out-Null
}

# Process images
Get-ChildItem -Path "$PSScriptRoot\assets\images" -Recurse -Include *.jpg,*.jpeg,*.png | ForEach-Object {
    $relativePath = $_.FullName.Substring($PSScriptRoot.Length + 1)
    $outputPath = Join-Path $optimizedDir $relativePath
    $outputDir = [System.IO.Path]::GetDirectoryName($outputPath)
    
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir | Out-Null
    }
    
    $outputPath = [System.IO.Path]::ChangeExtension($outputPath, ".webp")
    
    # Convert to WebP with 80% quality (good balance between quality and size)
    cwebp -q 80 $_.FullName -o $outputPath
    
    Write-Host "Optimized: $relativePath"
}

Write-Host "Optimization complete! Optimized images saved to: $optimizedDir"
