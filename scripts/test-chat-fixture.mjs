import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fixture = resolve(root, "native/windows/Milo.TestChat");
const project = readFileSync(resolve(fixture, "Milo.TestChat.csproj"), "utf8");
const source = ["App.xaml.cs", "FixtureOptions.cs", "SyntheticConversation.cs", "OcrOnlyConversationCanvas.cs", "MainWindow.xaml", "MainWindow.xaml.cs"]
  .map((name) => readFileSync(resolve(fixture, name), "utf8"))
  .join("\n");
const docs = readFileSync(resolve(fixture, "README.md"), "utf8");

const required = [
  "net10.0-windows10.0.19041.0",
  "UseWPF",
  "FixtureMode.OcrOnly",
  "FixtureLanguage.Italian",
  "AppendButton_OnClick",
  "RecreateButton_OnClick",
  "CloseButton_OnClick",
  "AutomationProperties.SetName",
  "OcrOnlyConversationCanvas",
  "--mode=ocr",
  "--language=it",
];
for (const marker of required) {
  if (!source.includes(marker) && !project.includes(marker) && !docs.includes(marker)) throw new Error(`Missing fixture contract marker: ${marker}`);
}

const forbidden = [
  /HttpClient|WebClient|WebRequest|System\.Net/i,
  /Clipboard/i,
  /Process\.Start|ProcessStartInfo/i,
  /File\.(Read|Write|Open|Create)|FileStream/i,
  /Socket|TcpClient|UdpClient/i,
];
for (const pattern of forbidden) {
  if (pattern.test(source)) throw new Error(`Forbidden fixture capability: ${pattern}`);
}

const ocr = readFileSync(resolve(fixture, "OcrOnlyConversationCanvas.cs"), "utf8");
const ocrCode = ocr.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
if (/TextBlock|AutomationPeer|AutomationProperties/.test(ocrCode)) {
  throw new Error("OCR-only surface must not expose message text through UIA controls or peers");
}

console.log("Milo.TestChat contract passed: synthetic-only, offline, UIA/OCR modes, lifecycle controls");
