$ErrorActionPreference = 'Stop'
try {
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) {
        throw 'Install Node.js 22 or later before configuring this plugin.'
    }
    Write-Host 'In Penpot: Your account > Integrations > MCP Server > Copy server URL.'
    $secret = Read-Host 'Paste the full URL (input is hidden)' -AsSecureString
    $plain = [System.Net.NetworkCredential]::new('', $secret).Password
    $uri = [Uri]$plain.Trim()
    if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'design.penpot.app' -or
        -not $uri.IsDefaultPort -or $uri.AbsolutePath -ne '/mcp/stream' -or
        $uri.UserInfo -or $uri.Fragment -or $uri.Query -notmatch '(?:[?&])userToken=[^&]+') {
        throw 'Use the official design.penpot.app MCP URL copied from your account.'
    }
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
    Write-Error 'Setup failed. Check Node.js 22+ and use the full official MCP URL. No connection was made.'
    exit 1
}
