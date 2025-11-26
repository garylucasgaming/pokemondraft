$files = @(
  'src\App.js',
  'socket-server.js'
)

foreach ($file in $files) {
  Write-Host "Processing $file..."
  $content = Get-Content $file -Raw
  
  # Remove console.log statements (keep console.error)
  # Pattern 1: Single line console.log
  $content = $content -replace '\s*console\.log\([^;]*\);\r?\n', ''
  
  # Pattern 2: Multi-line console.log
  $content = $content -replace '\s*console\.log\([^)]*\([^)]*\)[^)]*\);\r?\n', ''
  
  Set-Content $file -Value $content -NoNewline
  Write-Host "✓ Cleaned $file"
}

Write-Host "`n✓ All files cleaned!"
