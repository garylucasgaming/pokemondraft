#!/usr/bin/env pwsh

# Remove debug console.log statements from source files
# Keeps console.error for debugging

$files = @(
  'src\App.js',
  'socket-server.js'
)

foreach ($file in $files) {
  Write-Host "`nProcessing $file..."
  
  $lines = Get-Content $file
  $newLines = @()
  $skipNext = $false
  
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    # Skip lines that are console.log (but keep console.error)
    if ($line -match '^\s*console\.log\(' -and $line -notmatch 'console\.error') {
      # Check if it's a multi-line console.log
      if ($line -notmatch '\);' -and $line -notmatch ';$') {
        # Multi-line - skip until we find the closing
        while ($i -lt $lines.Count -and $lines[$i] -notmatch '\);') {
          $i++
        }
        $i++ # Skip the closing line too
      }
      # Skip this line (single-line console.log or we just skipped multi-line)
      continue
    }
    
    $newLines += $line
  }
  
  # Write back to file
  $newLines | Set-Content $file -Encoding UTF8
  
  $removed = $lines.Count - $newLines.Count
  Write-Host "✓ Removed $removed lines from $file"
}

Write-Host "`n✓ All files cleaned!"
