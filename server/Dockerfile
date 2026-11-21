FROM node:24-bookworm-slim

# Chromium is the whole point: the Alloha player signs its stream request in JS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY alloha.mjs .

ENV PORT=8790 \
    CHROME=/usr/bin/chromium \
    CHROME_ARGS="--no-sandbox --disable-dev-shm-usage"

EXPOSE 8790
CMD ["node", "alloha.mjs"]
