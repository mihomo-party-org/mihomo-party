import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import React from 'react'
import SettingItem from '../base/base-setting-item'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
interface Props {
  connection: IMihomoConnectionDetail
  onClose: () => void
}

const ConnectionDetailModal: React.FC<Props> = (props) => {
  const { connection, onClose } = props
  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="flag-emoji break-all">
        <ModalHeader className="flex">连接详情</ModalHeader>
        <ModalBody>
          <SettingItem title="连接类型">
            {connection.metadata.type}({connection.metadata.network})
          </SettingItem>
          <SettingItem title="连接建立时间">{dayjs(connection.start).fromNow()}</SettingItem>
          <SettingItem title="规则">
            {connection.rule}
            {connection.rulePayload ? `(${connection.rulePayload})` : ''}
          </SettingItem>
          <SettingItem title="代理链">{[...connection.chains].reverse().join('>>')}</SettingItem>
          <SettingItem title="上传速度">{calcTraffic(connection.uploadSpeed || 0)}/s</SettingItem>
          <SettingItem title="下载速度">{calcTraffic(connection.downloadSpeed || 0)}/s</SettingItem>
          <SettingItem title="上传量">{calcTraffic(connection.upload)}</SettingItem>
          <SettingItem title="下载量">{calcTraffic(connection.download)}</SettingItem>
          {connection.metadata.process && (
            <SettingItem title="进程名">
              {connection.metadata.process}
              {connection.metadata.uid ? `(${connection.metadata.uid})` : ''}
            </SettingItem>
          )}
          {connection.metadata.processPath && (
            <SettingItem title="进程路径">{connection.metadata.processPath}</SettingItem>
          )}
          {connection.metadata.sourceIP && (
            <SettingItem title="源IP">{connection.metadata.sourceIP}</SettingItem>
          )}
          {connection.metadata.destinationIP && (
            <SettingItem title="目标IP">{connection.metadata.destinationIP}</SettingItem>
          )}
          {connection.metadata.destinationGeoIP && (
            <SettingItem title="目标GeoIP">{connection.metadata.destinationGeoIP}</SettingItem>
          )}
          {connection.metadata.destinationIPASN && (
            <SettingItem title="目标ASN">{connection.metadata.destinationIPASN}</SettingItem>
          )}
          {connection.metadata.sourcePort && (
            <SettingItem title="源端口">{connection.metadata.sourcePort}</SettingItem>
          )}
          {connection.metadata.destinationPort && (
            <SettingItem title="目标端口">{connection.metadata.destinationPort}</SettingItem>
          )}
          {connection.metadata.inboundIP && (
            <SettingItem title="入站IP">{connection.metadata.inboundIP}</SettingItem>
          )}
          {connection.metadata.inboundPort && (
            <SettingItem title="入站端口">{connection.metadata.inboundPort}</SettingItem>
          )}
          {connection.metadata.inboundName && (
            <SettingItem title="入站名称">{connection.metadata.inboundName}</SettingItem>
          )}
          {connection.metadata.inboundUser && (
            <SettingItem title="入站用户">{connection.metadata.inboundUser}</SettingItem>
          )}
          {connection.metadata.host && (
            <SettingItem title="主机">{connection.metadata.host}</SettingItem>
          )}
          {connection.metadata.dnsMode && (
            <SettingItem title="DNS模式">{connection.metadata.dnsMode}</SettingItem>
          )}
          {connection.metadata.specialProxy && (
            <SettingItem title="特殊代理">{connection.metadata.specialProxy}</SettingItem>
          )}
          {connection.metadata.specialRules && (
            <SettingItem title="特殊规则">{connection.metadata.specialRules}</SettingItem>
          )}
          {connection.metadata.remoteDestination && (
            <SettingItem title="远程目标">{connection.metadata.remoteDestination}</SettingItem>
          )}
          <SettingItem title="DSCP">{connection.metadata.dscp}</SettingItem>
          {connection.metadata.sniffHost && (
            <SettingItem title="嗅探主机">{connection.metadata.sniffHost}</SettingItem>
          )}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onClose}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConnectionDetailModal
