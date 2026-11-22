FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# wireproxy is a userspace WireGuard client: it gives the resolver a Cloudflare WARP exit
# without /dev/net/tun, which a container on this host does not have. The release asset below
# is amd64-only, so a build for any other architecture has to fail loudly instead of shipping
# a binary that cannot run.
ARG TARGETARCH=amd64
RUN [ "$TARGETARCH" = "amd64" ] || { echo "this Dockerfile pins wireproxy_linux_amd64" >&2; exit 1; }
ADD --checksum=sha256:e88c1d090740373fc606c1bafd81d9a5eadc642cce5667616e20e9d7a444f51c https://github.com/pufferffish/wireproxy/releases/download/v1.1.3/wireproxy_linux_amd64.tar.gz /tmp/wireproxy.tgz
RUN tar xzf /tmp/wireproxy.tgz -C /usr/local/bin && chmod +x /usr/local/bin/wireproxy && rm /tmp/wireproxy.tgz

# curl-impersonate makes every HTTP request look like Chrome down to the TLS handshake
# (cfetch in alloha.mjs); Node's own fetch is recognised as a bot. Same amd64-only pin.
ADD --checksum=sha256:bc9bd2522fe1850dd54c0fff189c8dd606df3f222ab2a905f2dd255123c3f495 https://github.com/lexiforest/curl-impersonate/releases/download/v2.3.2/curl-impersonate-v2.3.2.x86_64-linux-gnu.tar.gz /tmp/curl-impersonate.tgz
RUN tar xzf /tmp/curl-impersonate.tgz -C /usr/local/bin curl-impersonate && rm /tmp/curl-impersonate.tgz

WORKDIR /app
COPY alloha.mjs alloha-sign.mjs entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENV PORT=8790

EXPOSE 8790
CMD ["./entrypoint.sh"]
