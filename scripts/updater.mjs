/* eslint-disable @typescript-eslint/explicit-function-return-type */
import axios from 'axios'
import yaml from 'yaml'
import fs from 'fs'

let file = 'latest.yml'
if (process.argv.slice(2).length !== 0) {
  file = process.argv.slice(2)[0]
}

async function check() {
  try {
    const res = await axios.get(
      `https://github.com/pompurin404/mihomo-party/releases/latest/download/${file}`,
      {
        headers: { 'Content-Type': 'application/octet-stream' }
      }
    )
    const remoteData = yaml.parse(res.data)
    const currentData = yaml.parse(fs.readFileSync(`dist/${file}`, 'utf8'))
    remoteData.files.push(...currentData.files)
    remoteData.releaseDate = `${new Date().toISOString()}`
    fs.writeFileSync(`dist/${file}`, yaml.stringify(remoteData))
  } catch (error) {
    return
  }
}

check().catch((error) => {
  console.error(error)
  process.exit(0)
})
