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
curl -sS -o upstream/online_mod.js \
  https://nb557.github.io/plugins/online_mod.js
diff -u upstream/torbox-lampa-plugin.js plugin/torbox-lampa-plugin.js
diff -u upstream/online_mod.js plugin/online_mod.js
```

## online_mod

- Source: https://nb557.github.io/plugins/online_mod.js
- Forked: 2026-11-08
- Our working copy: `plugin/online_mod.js`
- Change: added the `narutobased` balancer (`Balancers` entry + module).
  It uses `https://anime.home.kopenkin.tech/api/*` and the site's
  `/api/lampa/play/<slug>?language=...` endpoint.
