import axios from 'axios'
import { readFileSync } from 'fs'

const chat_id = '@mihomo_party_group'
const pkg = readFileSync('package.json', 'utf-8')
const changelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)
const downloadUrl = `https://github.com/mihomo-party-org/mihomo-party/releases/download/v${version}`
let content = `<b>🌟 <a href="https://github.com/mihomo-party-org/mihomo-party/releases/tag/v${version}">Mihomo Party v${version}</a> 正式发布</b>\n\n`
for (const line of changelog.split('\n')) {
  if (line.length === 0) {
    content += '\n'
  } else if (line.startsWith('### ')) {
    content += `<b>${line.replace('### ', '')}</b>\n`
  } else {
    content += `${line}\n`
  }
}

content += '\n<b>下载地址：</b>\n<b>Windows10/11：</b>\n'
content += `安装版：<a href="${downloadUrl}/mihomo-party-windows-${version}-x64-setup.exe">64位</a> | <a href="${downloadUrl}/mihomo-party-windows-${version}-ia32-setup.exe">32位</a> | <a href="${downloadUrl}/mihomo-party-windows-${version}-arm64-setup.exe">ARM64</a>\n`
content += `便携版：<a href="${downloadUrl}/mihomo-party-windows-${version}-x64-portable.7z">64位</a> | <a href="${downloadUrl}/mihomo-party-windows-${version}-ia32-portable.7z">32位</a> | <a href="${downloadUrl}/mihomo-party-windows-${version}-arm64-portable.7z">ARM64</a>\n`
content += '\n<b>Windows7/8：</b>\n'
content += `安装版：<a href="${downloadUrl}/mihomo-party-win7-${version}-x64-setup.exe">64位</a> | <a href="${downloadUrl}/mihomo-party-win7-${version}-ia32-setup.exe">32位</a>\n`
content += `便携版：<a href="${downloadUrl}/mihomo-party-win7-${version}-x64-portable.7z">64位</a> | <a href="${downloadUrl}/mihomo-party-win7-${version}-ia32-portable.7z">32位</a>\n`
content += '\n<b>macOS：</b>\n'
content += `DMG：<a href="${downloadUrl}/mihomo-party-macos-${version}-x64.dmg
">Intel</a> | <a href="${downloadUrl}/mihomo-party-macos-${version}-arm64.dmg">Apple Silicon</a>\n`
content += '\n<b>Linux：</b>\n'
content += `DEB：<a href="${downloadUrl}/mihomo-party-linux-${version}-amd64.deb
">64位</a> | <a href="${downloadUrl}/mihomo-party-linux-${version}-arm64.deb">ARM64</a>\n`
content += `RPM：<a href="${downloadUrl}/mihomo-party-linux-${version}-x86_64.rpm">64位</a> | <a href="${downloadUrl}/mihomo-party-linux-${version}-aarch64.rpm">ARM64</a>`

const { data: messageData } = await axios.post(
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
  {
    chat_id,
    text: content,
    link_preview_options: {
      is_disabled: false,
      url: 'https://github.com/mihomo-party-org/mihomo-party',
      prefer_large_media: true
    },
    parse_mode: 'HTML'
  }
)

const { data: chatData } = await axios.post(
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getChat`,
  {
    chat_id
  }
)

if (chatData.result.pinned_message.from.is_bot) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/unpinChatMessage`,
    {
      chat_id,
      message_id: chatData.result.pinned_message.message_id
    }
  )
}

await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/pinChatMessage`, {
  chat_id,
  message_id: messageData.result.message_id
})
