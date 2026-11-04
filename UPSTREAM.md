# Upstream

- Source: https://slonce70.github.io/addon_lampa_torbox/torbox-lampa-plugin.js
- Forked: 2026-11-04
- Upstream version in the banner: `51.2.14` (`const VERSION` in the file)
- Our working copy: `plugin/torbox-lampa-plugin.js`

The pristine upstream copy is intentionally **not** kept in this repository.
To compare again, download it next to the repo (the folder is git-ignored):

```bash
mkdir -p upstream
curl -sS -o upstream/torbox-lampa-plugin.js \
  https://slonce70.github.io/addon_lampa_torbox/torbox-lampa-plugin.js
diff -u upstream/torbox-lampa-plugin.js plugin/torbox-lampa-plugin.js
```
