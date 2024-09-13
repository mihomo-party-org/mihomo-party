import axios from 'axios'
import { readFileSync } from 'fs'

const pkg = readFileSync('package.json', 'utf-8')
const changelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)
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
axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  chat_id: '@mihomo_party_channel',
  text: content,
  link_preview_options: {
    is_disabled: false,
    url: 'https://github.com/mihomo-party-org/mihomo-party',
    prefer_large_media: true
  },
  parse_mode: 'HTML'
})
