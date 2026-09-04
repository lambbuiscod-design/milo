import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..", "..");

test("native helper extraction is bounded and fail-closed", async () => {
  const nativeRoot = path.join(repositoryRoot, "native", "windows");
  const [program, catalog, extractor] = await Promise.all([
    readFile(path.join(nativeRoot, "Program.cs"), "utf8"),
    readFile(path.join(nativeRoot, "WindowCatalog.cs"), "utf8"),
    readFile(path.join(nativeRoot, "WindowTextExtractor.cs"), "utf8"),
  ]);

  assert.match(program, /MaxLineBytes\s*=\s*16\s*\*\s*1024/);
  assert.match(program, /utf8ByteCount/);
  assert.match(program, /Utf8ByteCountForBmpChar/);
  assert.match(program, /utf8ByteCount\s*\+\s*byteCount\s*>\s*MaxLineBytes/);
  assert.match(program, /UnmappedMemberHandling\s*=\s*JsonUnmappedMemberHandling\.Disallow/);
  assert.match(program, /"list_windows"/);
  assert.match(program, /"extract_text"/);
  assert.match(program, /"capture_text"/);
  assert.match(program, /request\.Language\s+is\s+not\s+\(\"en\"\s+or\s+\"it\"\)/);
  assert.match(program, /IsValidRequestId\(request\.Id\)/);
  assert.match(program, /value\.Length\s*==\s*32/);
  assert.match(program, /ProcessCreationTime/);
  assert.match(program, /long\.TryParse\(request\.ProcessCreationTime/);
  assert.match(program, /CultureInfo\.InvariantCulture/);
  assert.match(program, /TryGetKnownEligible\(request\.Hwnd\.Value, request\.Pid\.Value, processCreationTime/);
  assert.match(program, /TryGetKnownEligible\(request\.Hwnd\.Value, request\.Pid\.Value/);
  assert.match(program, /request\.MaxChars\s+is\s+<\s+256\s+or\s+>\s+12_000/);
  assert.match(catalog, /knownWindows/);
  assert.match(catalog, /knownWindows\.Contains\(new WindowIdentity\(hwnd, pid, processCreationTime\)\)/);
  assert.match(catalog, /currentPid\s*!=\s*pid/);
  assert.match(catalog, /TryGetProcessCreationTime\(currentPid, out var currentCreationTime\)/);
  assert.match(catalog, /currentCreationTime\s*!=\s*processCreationTime/);
  assert.match(catalog, /ToString\(CultureInfo\.InvariantCulture\)/);
  assert.match(extractor, /MaxElements\s*=\s*120/);
  assert.match(extractor, /MaxChars\s*=\s*12_000/);
  assert.match(extractor, /AutomationElement\.FromHandle/);
  assert.match(extractor, /HashSet<string>\(StringComparer\.Ordinal\)/);
  assert.match(extractor, /observedValues\.Add\(normalized\)/);
  const capture = await readFile(path.join(nativeRoot, "WindowCaptureOcr.cs"), "utf8");
  assert.match(capture, /GraphicsCaptureItem/);
  assert.match(capture, /CreateForWindow/);
  assert.match(capture, /GraphicsCaptureSession\.IsSupported/);
  assert.match(capture, /OcrEngine\.TryCreateFromLanguage/);
  assert.match(capture, /Direct3D11CaptureFramePool/);
  assert.match(capture, /SoftwareBitmap\.CreateCopyFromSurfaceAsync/);
  assert.doesNotMatch(capture, /CreateForMonitor|GraphicsCapturePicker|TryCreateFromDisplay/);
  assert.match(capture, /session\.IsCursorCaptureEnabled\s*=\s*false/);
  assert.match(capture, /DisposeIfSupported\(frame\)/);
  assert.match(capture, /DisposeIfSupported\(bitmap\)/);
  assert.match(capture, /DisposeIfSupported\(session\)/);
  assert.match(capture, /DisposeIfSupported\(framePool\)/);
  assert.match(capture, /value is IDisposable disposable/);
  assert.doesNotMatch(capture, /File\.|FileStream|Process\.Start|HttpClient|WebClient/);
  assert.doesNotMatch(extractor, /File\.|FileStream|Process\.Start|HttpClient|WebClient/);
});
