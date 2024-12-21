import yaml from 'yaml'
import { readFileSync, writeFileSync } from 'fs'

const pkg = readFileSync('package.json', 'utf-8')
let changelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)
const downloadUrl = `https://github.com/xishang0128/mihomo-party/releases/download/v${version}`
const latest = {
  version,
  changelog
}

changelog += '\n### 下载地址：\n\n#### Windows10/11：\n\n'
changelog += `- 安装版：[64位](${downloadUrl}/mihomo-party-windows-${version}-x64-setup.exe) | [ARM64](${downloadUrl}/mihomo-party-windows-${version}-arm64-setup.exe)\n\n`
changelog += '\n#### macOS 11+：\n\n'
changelog += `- PKG：[Intel](${downloadUrl}/mihomo-party-macos-${version}-x64.pkg) | [Apple Silicon](${downloadUrl}/mihomo-party-macos-${version}-arm64.pkg)\n\n`
changelog += '\n#### Linux：\n\n'
changelog += `- DEB：[64位](${downloadUrl}/mihomo-party-linux-${version}-amd64.deb) | [ARM64](${downloadUrl}/mihomo-party-linux-${version}-arm64.deb)\n\n`
changelog += `- RPM：[64位](${downloadUrl}/mihomo-party-linux-${version}-x86_64.rpm) | [ARM64](${downloadUrl}/mihomo-party-linux-${version}-aarch64.rpm)`

writeFileSync('latest.yml', yaml.stringify(latest))
writeFileSync('changelog.md', changelog)
