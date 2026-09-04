import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/desktop/.vite/renderer/main_window");
const port = Number(process.env.MILO_DESKTOP_PREVIEW_PORT ?? "3101");
const initial = {
  state: "idle", panelOpen: true, panelPlacement: "right-down",
  watching: { paused: false, selectedWindow: { available: true, title: "Synthetic chat preview", processId: null }, capability: { available: true } },
  settings: { theme: "dark", motion: "reduced", showWatchingIndicator: true },
  auth: { status: "authenticated", expiresAt: null, storageAvailable: true },
  replies: [], lastAction: "none",
};

const mock = `<script>
(() => {
  let snapshot = ${JSON.stringify(initial)}; const listeners = new Set();
  const publish = () => { for (const listener of listeners) listener(snapshot); };
  const api = {
    getSnapshot: async () => snapshot,
    onStateChanged: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    setPanelOpen: async (open) => (snapshot = {...snapshot, panelOpen: open}, publish(), snapshot),
    selectWindow: async (input) => input?.sourceId ? (snapshot = {...snapshot, watching: {...snapshot.watching, selectedWindow: {available:true, title:'Synthetic chat preview', processId:null}}}, publish(), {mode:'selected', window:snapshot.watching.selectedWindow}) : {mode:'candidates', candidates:[{sourceId:'window:1:1', title:'Synthetic chat preview'}]},
    pauseWatching: async (paused) => (snapshot = {...snapshot, state: paused ? 'paused' : 'idle', watching: {...snapshot.watching, paused}}, publish(), snapshot.watching),
    previewContext: async () => ({text:'Participant: Local browser preview context',messageCount:1,truncated:false,participantNamesRemoved:true,maxMessages:8}),
    askMilo: async () => { snapshot = {...snapshot, state:'ready', replies:[{id:'safe',label:'Safe choice',text:'That sounds lovely. What day works best for you?',explanation:'Warm and low pressure.'},{id:'confident',label:'Confident choice',text:'I’m in. Let’s pick a time and make it happen.',explanation:'Clear and direct.'},{id:'playful',label:'Playful choice',text:'Deal, but I’m choosing the dessert spot.',explanation:'Light personality without pressure.'}]}; publish(); return {mode:'live', warning:null, replies:snapshot.replies}; },
    copyReply: async () => {}, getSettings: async () => snapshot.settings, updateSettings: async (patch) => (snapshot = {...snapshot, settings:{...snapshot.settings,...patch}}, publish(), snapshot.settings),
    openAccount: async () => {}, signIn: async () => (snapshot = {...snapshot, auth:{status:'authenticated',expiresAt:null,storageAvailable:true}}, publish(), snapshot.auth), signOut: async () => (snapshot = {...snapshot, auth:{status:'signed_out',expiresAt:null,storageAvailable:true}, replies:[]}, publish(), snapshot.auth), previewState: async () => snapshot, nudgePosition: async () => {}, resetPosition: async () => {}, openContextMenu: async () => {}, quit: async () => {},
  }; window.milo = api;
})();
</script>`;

const server = createServer(async (request, response) => {
  const requested = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const relative = requested === "/" || requested === "/demo" ? "index.html" : requested.replace(/^\//, "");
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(404); response.end("Not found"); return; }
  try {
    let body = await readFile(file);
    if (relative === "index.html") body = body.toString().replace(/<meta[^>]+Content-Security-Policy[^>]+>/i, "").replace("<script type=\"module\"", `${mock}<script type="module"`);
    response.writeHead(200, { "Content-Type": relative.endsWith(".css") ? "text/css" : relative.endsWith(".js") ? "text/javascript" : "text/html" });
    response.end(body);
  } catch { response.writeHead(404); response.end("Not found"); }
});
server.listen(port, "127.0.0.1", () => console.log(`Milo desktop browser preview: http://127.0.0.1:${port}/`));
