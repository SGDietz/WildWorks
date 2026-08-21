$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WildWorksCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct CREDENTIAL {
    public uint Flags; public uint Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("Advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("Advapi32.dll", SetLastError=true)] private static extern void CredFree(IntPtr credential);
  public static string[] Read(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      CREDENTIAL value = Marshal.PtrToStructure<CREDENTIAL>(pointer);
      string secret = value.CredentialBlobSize == 0 ? "" : Marshal.PtrToStringUni(value.CredentialBlob, (int)value.CredentialBlobSize / 2);
      return new [] { value.UserName ?? "", secret ?? "" };
    } finally { CredFree(pointer); }
  }
}
'@

$credential = [WildWorksCredentialReader]::Read('TelegramAlertBot')
if ($credential[0] -ne 'telegram-bot-token' -or [string]::IsNullOrWhiteSpace($credential[1])) {
  throw 'TelegramAlertBot credential identity is invalid.'
}
$chatId = [Environment]::GetEnvironmentVariable('TELEGRAM_ALERT_CHAT_ID', 'User')
if ([string]::IsNullOrWhiteSpace($chatId) -or $chatId -notmatch '^-?\d{5,20}$') {
  throw 'TELEGRAM_ALERT_CHAT_ID user variable is missing or invalid.'
}
@{ token = $credential[1]; chatId = $chatId } | ConvertTo-Json -Compress
