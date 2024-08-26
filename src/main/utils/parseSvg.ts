import { Worker } from 'worker_threads'

export default function parseSvg(svgStr: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerString, {
      eval: true,
      workerData: svgStr
    })
    worker.on('message', resolve)
    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`))
    })
  })
}

const workerString = `
const { parentPort, workerData } = require('worker_threads')
const svg2img = require('svg2img')

const svgStr = workerData
svg2img(svgStr, (err, buffer) => {
  if (err) {
    throw err
  }
  parentPort?.postMessage(buffer)
})
`
