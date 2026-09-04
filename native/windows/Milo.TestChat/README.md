# Milo.TestChat

`Milo.TestChat` is a local, synthetic Windows chat fixture for validating Milo's selected-window extraction boundary. It contains no real conversations, network client, persistence, clipboard access, message sending, or external process launch.

## Modes

Run the accessible mode (default) with standard WPF text controls:

```powershell
dotnet run --project native/windows/Milo.TestChat/Milo.TestChat.csproj -- --mode=uia --language=en
```

Run the owner-drawn OCR-only mode with English or Italian sample text:

```powershell
dotnet run --project native/windows/Milo.TestChat/Milo.TestChat.csproj -- --mode=ocr --language=it
```

The title and subtitle identify the selected mode and language. **Append message** adds a deterministic synthetic message. **Close window** closes the current fixture. **Close + recreate window** creates a new window instance so stale HWND/identity handling can be tested.

Automated desktop tests may add `--auto-append-ms=4000` (bounded from 1000 to 30000 ms) to append one synthetic message without using OS input automation.

In UIA mode each message is a normal WPF `TextBlock` with an accessible name. OCR-only mode uses a custom owner-drawn surface with no message `TextBlock` children or custom UI Automation peer; the same visible text is therefore available to selected-window capture/OCR but not as a readable UIA conversation tree. The controls remain accessible in both modes.

## Build and verification

Use the repository-pinned .NET SDK (`global.json`):

```powershell
dotnet build native/windows/Milo.TestChat/Milo.TestChat.csproj --configuration Release
node scripts/test-chat-fixture.mjs
```

The contract check is intentionally source-based and fails if fixture code gains network, file, clipboard, or arbitrary process surfaces. Manual Windows verification should confirm UIA text in accessible mode, no conversation text in the OCR-only UIA tree, append behavior, and changed HWND after recreation.
