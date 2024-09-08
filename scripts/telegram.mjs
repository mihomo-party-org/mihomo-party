import axios from 'axios'
import { readFileSync } from 'fs'

const pkg = readFileSync('package.json', 'utf-8')
const changelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)
let content = `<b>🌟Mihomo Party v${version} 正式发布</b>\n\n`
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
  parse_mode: 'HTML',
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '官方群组',
          url: 'https://t.me/mihomo_party'
        },
        {
          text: '官方频道',
          url: 'https://t.me/mihomo_party_channel'
        }
      ],
      [
        {
          text: '官方文档',
          url: 'https://mihomo.party'
        }
      ],
      [
        {
          text: '前往下载',
          url: `https://github.com/pompurin404/mihomo-party/releases/tag/v${version}`
        }
      ]
    ]
  }
})
