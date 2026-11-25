#!/bin/sh
set -e
# A bind mount of a missing file arrives as a directory, which would silently run without WARP.
if [ -d /opt/wireproxy.conf ]; then
  echo "wireproxy.conf is a directory: create server/wireproxy.conf on the host" >&2
  exit 1
fi

# Prints the exit IP when the tunnel really carries traffic, exits non-zero otherwise.
cat > /tmp/warp-check.mjs <<'EOF'
try {
  const trail = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(5000) });
  const text = await trail.text();
  if (!/warp=(on|plus)/.test(text)) throw new Error('warp is off');
  console.log((text.match(/ip=([0-9.]+)/) || [])[1]);
} catch (e) {
  // A failing probe is normal while the tunnel restarts; it must not dump a stack into the logs.
  console.error('warp check:', e.message);
  process.exit(1);
}
EOF

# pkill is not in the image, and the proxy port can only be bound once, so a leftover is
# hunted down by process name before every start. /proc/PID/comm is the name only, which keeps
# this from matching its own grep.
stop_tunnel() {
  for p in /proc/[0-9]*; do
    if [ "$(cat "$p/comm" 2>/dev/null)" = wireproxy ]; then kill -TERM "${p#/proc/}" 2>/dev/null || true; fi
  done
  sleep 2
  for p in /proc/[0-9]*; do
    if [ "$(cat "$p/comm" 2>/dev/null)" = wireproxy ]; then kill -KILL "${p#/proc/}" 2>/dev/null || true; fi
  done
}

if [ -f /opt/wireproxy.conf ]; then
  # Turbo's CDN stalls after ~16 KB over WARP and its links are bound to the IP that asked obrut,
  # so the whole Turbo chain (obrut + CDN) goes out directly, like it does from a home machine.
  # Leading dots are required: Node's undici only matches an exact host or a "." suffix, so a bare
  # "obrut.show" does not cover cdn-xxxx.obrut.show.
  # rezka is reached directly too, its bot check is about the user agent, not WARP.
  # TorBox too: it needs no residential IP, and WARP exits may be blocked.
  export NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:40000 NO_PROXY=.obrut.show,.superdupercdn.com,rezka.ag,.rezka.ag,hdrezka.ag,.hdrezka.ag,api.torbox.app no_proxy=.obrut.show,.superdupercdn.com,rezka.ag,.rezka.ag,hdrezka.ag,.hdrezka.ag,api.torbox.app

  # Alloha only hands out usable stream tokens to residential-looking IPs. The tunnel also
  # wedges now and then without exiting — DNS inside it times out and every request fails —
  # so it is supervised: a probe that stops answering restarts it. The outer loop keeps the
  # supervisor itself alive.
  (
    while :; do
      (
        while :; do
          stop_tunnel
          wireproxy -c /opt/wireproxy.conf &
          WP=$!
          # Wait for traffic to actually pass, but give up if the process dies first.
          i=0
          while [ "$i" -lt 20 ]; do
            node /tmp/warp-check.mjs && break
            kill -0 "$WP" 2>/dev/null || break
            i=$((i + 1))
            sleep 1
          done
          while kill -0 "$WP" 2>/dev/null; do
            # Short window: hls.js gives up on fragments after a few failed retries, so a wedged
            # tunnel has to be replaced before the player decides playback is unrecoverable.
            sleep 10
            kill -0 "$WP" 2>/dev/null || break
            node /tmp/warp-check.mjs >/dev/null 2>&1 && continue
            # One bad probe can be a blip; two in a row mean the tunnel is wedged.
            sleep 2
            node /tmp/warp-check.mjs >/dev/null 2>&1 && continue
            echo "warp stopped answering, restarting the tunnel" >&2
            break
          done
          echo "wireproxy is gone, restarting the tunnel" >&2
          sleep 2
        done
      )
      echo "tunnel supervisor exited, restarting it" >&2
      sleep 2
    done
  ) &
fi

exec node alloha.mjs