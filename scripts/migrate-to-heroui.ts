import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const srcDir = path.join(__dirname, '..', 'src')

function replaceInFile(filePath: string): void {
  let content = fs.readFileSync(filePath, 'utf8')
  
  // 替换导入语句
  content = content.replace(
    /@nextui-org\/react/g,
    '@heroui/react'
  )
  
  // 替换 NextUIProvider
  content = content.replace(
    /NextUIProvider/g,
    'HeroUIProvider'
  )
  
  fs.writeFileSync(filePath, content)
}

function walkDir(dir: string): void {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      walkDir(filePath)
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      replaceInFile(filePath)
    }
  })
}

walkDir(srcDir)
console.log('Migration completed!') 