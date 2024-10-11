import axios from 'axios'
import { readFileSync } from 'fs'

const chat_id = '@mihomo_party_group'
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
