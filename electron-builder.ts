import type { Configuration } from 'electron-builder'
import { appVersion } from './scripts/app-version'

const config: Configuration = {
  appId: 'ar.horizonbytes.spbspy',
  executableName: 'SpbSpy',
  // La version de los paquetes sale de los tags de git, no de package.json
  extraMetadata: {
    version: appVersion()
  },
  directories: {
    buildResources: 'build'
  },
  files: [
    '!**/.vscode/*',
    '!.devcontainer/*',
    '!.github/*',
    '!scripts/*',
    '!src/*',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!{.eslintcache,eslint.config.mjs,.gitlab-ci.yml,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
    '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
    '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
  ],
  asarUnpack: ['resources/**'],
  nsis: {
    artifactName: '${productName}-${version}-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always'
  },
  mac: {
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: [
      { NSCameraUsageDescription: "Application requests access to the device's camera." },
      { NSMicrophoneUsageDescription: "Application requests access to the device's microphone." },
      {
        NSDocumentsFolderUsageDescription:
          "Application requests access to the user's Documents folder."
      },
      {
        NSDownloadsFolderUsageDescription:
          "Application requests access to the user's Downloads folder."
      }
    ],
    notarize: false
  },
  dmg: {
    artifactName: '${productName}-${version}.${ext}'
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Utility'
  },
  appImage: {
    artifactName: '${productName}-${version}.${ext}'
  },
  npmRebuild: false,
  // La app busca sus actualizaciones en los releases de este repo
  publish: {
    provider: 'github',
    owner: 'ejmarino',
    repo: 'spb-spy'
  }
}

export default config
