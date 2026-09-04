# Milo desktop instructions

- Treat `../../docs/SECURITY-INVARIANTS.md` as mandatory.
- The renderer is untrusted. Keep Electron, Node, filesystem, network, tokens, native helpers, and generic IPC out of it.
- Keep every privileged operation behind a narrow typed preload method and validate inputs in preload and main.
- Load renderer assets only from `milo://app`; deny navigation, new windows, webviews, permissions, and DevTools.
- Persist only content-free preferences and per-display overlay coordinates. Never persist or log screenshots, OCR/conversation text, window titles, participant names, replies, clipboard content, or credentials.
- Phase 2 is a shell preview: no capture, authentication, provider calls, account links, or automatic messaging. Synthetic suggestions must be unmistakably labeled.
- Use local SVG, semantic color tokens, visible keyboard focus, text plus icons for state, and reduced-motion/forced-colors support.

