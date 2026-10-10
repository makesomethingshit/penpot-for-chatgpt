# Contributing

This repository is public and its project source license is undecided. Access to this repository does not establish a public redistribution license. Penpot artwork and bundled dependencies retain their respective rights.

## Change and verify

Use Node.js 22 or later. From the repository root:

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run check
npm run package
```

Edit `plugin/server/bridge-source.mjs` and rebuild instead of editing the bundled `bridge.mjs`. Commit the regenerated bundle, build metadata and third-party notices alongside the source. Tests use synthetic credentials and do not require a Penpot account.

Keep portable `plugin/plugin.json` and `.codex-plugin/plugin.json` metadata synchronized. Leave development changes unnumbered under `Unreleased`. At the first deployment, set `0.1.0` in both manifests and `package.json`/`package-lock.json`, update the changelog, and rebuild the package. Assign later versions only when preparing an actual release.

Keep skill instructions scoped to their workflow; specialists share `penpot-use`. Preserve file/page guards, component/token bindings and read-back verification. Do not add hooks, another MCP server or another workflow dependency to solve a documentation gap.

## Report a problem

Include the Git commit (or released plugin version), Node.js version, OS, desktop host, expected behavior, actual behavior and a minimal reproduction. Distinguish startup/authentication failures from a disconnected or sleeping Penpot tab. Omit your full MCP URL, account key, credential file and private design content. For security issues, follow [SECURITY.md](SECURITY.md).
