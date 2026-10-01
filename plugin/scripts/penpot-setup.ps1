$ErrorActionPreference = 'Stop'
$failureMessage = 'Setup failed. Install Node.js 22 or later and make node available on PATH.'
try {
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) {
        throw 'Install Node.js 22 or later before configuring this plugin.'
    }
    Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security') -ErrorAction Stop
    Write-Host 'In Penpot: Your account > Integrations > MCP Server > Copy server URL.'
    $secret = Read-Host 'Paste the full URL (input is hidden)' -AsSecureString
    $plain = [System.Net.NetworkCredential]::new('', $secret).Password
    $failureMessage = 'Setup failed. Copy the official MCP URL with exactly one non-empty userToken.'
    $validator = Join-Path $PSScriptRoot 'validate-connection.mjs'
    $plain | & node $validator
    if ($LASTEXITCODE -ne 0) { throw 'Invalid connection' }
    $failureMessage = 'Setup failed. Could not save the encrypted connection; check your Windows user profile access.'
    $directory = Join-Path $env:USERPROFILE '.penpot-for-chatgpt'
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $payload = @{ dpapi = ($secret | ConvertFrom-SecureString) } | ConvertTo-Json
    $temporary = Join-Path $directory ('connection-' + [Guid]::NewGuid().ToString() + '.tmp')
    [IO.File]::WriteAllText($temporary, $payload, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination (Join-Path $directory 'connection.json') -Force
    $plain = $null
    Write-Host 'Saved. The URL is encrypted for your Windows user; it was not sent anywhere.'
    Write-Host 'Open a Penpot file > File > MCP Server > Connect. Reload the desktop plugin connection.'
} catch {
    [Console]::Error.WriteLine($failureMessage)
    exit 1
} finally {
    $plain = $null
    $secret = $null
}
