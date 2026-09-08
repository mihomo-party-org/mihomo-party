import { WriteQueue } from '../utils/safeFile'

// profile.yaml 与 override.yaml 共用一个写队列：两份配置共同决定生成的运行配置。插件订阅提交的临界区
//（核对参与校验的 override 集合 → 落盘）与全局 override 的开关必须互相串行，否则核对与落盘之间的一次切换
// 会让落盘的"内容 + override"组合未经校验。队列不可重入：队列内的回调只能读这两份配置，不能再写。
export const runtimeConfigWriteQueue = new WriteQueue()
