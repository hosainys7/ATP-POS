Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $projectRoot "data"
$backupDir = Join-Path $projectRoot "backups"
$dbPath = Join-Path $dataDir "atelier.db"

# Never replace SQLite while the POS/backend is running.
$activePorts = @(3001, 5173) | Where-Object {
    Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue
}

if ($activePorts.Count -gt 0) {
    [System.Windows.Forms.MessageBox]::Show(
        "Le POS est encore ouvert. Lancez STOP_WINDOWS.bat puis recommencez la restauration.",
        "Restauration impossible",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
}

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Choisir une sauvegarde ATP POS"
$dialog.InitialDirectory = $backupDir
$dialog.Filter = "Sauvegarde SQLite (*.db)|*.db"
$dialog.Multiselect = $false

if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    exit 0
}

$selected = $dialog.FileName

# Basic SQLite file validation: first 16 bytes must contain 'SQLite format 3'.
try {
    $stream = [System.IO.File]::OpenRead($selected)
    $buffer = New-Object byte[] 16
    [void]$stream.Read($buffer, 0, 16)
    $stream.Close()
    $header = [System.Text.Encoding]::ASCII.GetString($buffer)
} catch {
    [System.Windows.Forms.MessageBox]::Show("Impossible de lire le fichier choisi.", "Erreur") | Out-Null
    exit 1
}

if (-not $header.StartsWith("SQLite format 3")) {
    [System.Windows.Forms.MessageBox]::Show(
        "Le fichier choisi ne semble pas etre une base SQLite ATP POS valide.",
        "Fichier invalide",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

$result = [System.Windows.Forms.MessageBox]::Show(
    "Restaurer cette sauvegarde ?`n`n$([System.IO.Path]::GetFileName($selected))`n`nLa base actuelle sera sauvegardee avant le remplacement.",
    "Confirmer la restauration",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
)

if ($result -ne [System.Windows.Forms.DialogResult]::Yes) {
    exit 0
}

try {
    if (Test-Path $dbPath) {
        $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
        $safetyBackup = Join-Path $backupDir "pre_restore_$timestamp.db"
        Copy-Item $dbPath $safetyBackup -Force
    }

    Copy-Item $selected $dbPath -Force

    # Remove stale WAL/SHM files if they exist after a previously closed session.
    Remove-Item "$dbPath-wal" -Force -ErrorAction SilentlyContinue
    Remove-Item "$dbPath-shm" -Force -ErrorAction SilentlyContinue

    [System.Windows.Forms.MessageBox]::Show(
        "Restauration terminee avec succes.`n`nVous pouvez maintenant lancer START_WINDOWS.bat.",
        "Restauration terminee",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
} catch {
    [System.Windows.Forms.MessageBox]::Show(
        "La restauration a echoue : $($_.Exception.Message)",
        "Erreur",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}
