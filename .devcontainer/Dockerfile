FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

# Librerias que necesita Electron (Chromium) para correr en Linux,
# herramientas para empaquetar (.deb/.rpm) y Wine para generar el
# instalador de Windows desde el contenedor con electron-builder.
RUN dpkg --add-architecture i386 \
    && apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        libgtk-3-0 libnss3 libasound2 libgbm1 libdrm2 libxss1 libxtst6 \
        libxshmfence1 libnotify4 libatk-bridge2.0-0 libcups2 libsecret-1-0 \
        libxkbcommon0 xdg-utils \
        fakeroot dpkg rpm \
        wine wine32:i386 wine64 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
