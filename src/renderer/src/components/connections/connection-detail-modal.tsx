import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@nextui-org/react'
import React from 'react'
import SettingItem from '../base/base-setting-item'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
import { BiCopy } from 'react-icons/bi'

interface Props {
  connection: IMihomoConnectionDetail
  onClose: () => void
}

const CopyableSettingItem: React.FC<{
  title: string
  value: string
  displayName?: string
  prefix?: string[]
  suffix?: string
}> = ({ title, value, displayName, prefix = [], suffix = '' }) => {
  const getSubDomains = (domain: string) =>
    domain.split('.').length <= 2
      ? [domain]
      : domain.split('.').map((_, i, parts) => parts.slice(i).join('.')).slice(0, -1)

  const menuItems = [
    { key: 'raw', text: value },
    ...prefix.flatMap(p =>
      (p === 'DOMAIN-SUFFIX'
        ? getSubDomains(value)
        : p === 'IP-ASN'
          ? [value.split(' ')[0]]
          : [value]
      ).map(v => ({
        key: `${p},${v}${suffix}`,
        text: `${p},${v}${suffix}`
      }))
    )
  ]

  return (
    <SettingItem
      title={title}
      actions={
        <Dropdown>
          <DropdownTrigger>
            <Button title='复制规则' isIconOnly size='sm' variant='light'>
              <BiCopy className='text-lg' />
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            onAction={key =>
              navigator.clipboard.writeText(key === 'raw' ? value : key as string)
            }
          >
            {menuItems.map(({ key, text }) => (
              <DropdownItem key={key}>{text}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      }
    >
      {displayName || value}
    </SettingItem>
  )
}

const ConnectionDetailModal: React.FC<Props> = (props) => {
  const { connection, onClose } = props
  return (
    <Modal
      backdrop='blur'
      classNames={{ backdrop: 'top-[48px]' }}
      size='xl'
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior='inside'
    >
      <ModalContent className='flag-emoji break-all'>
        <ModalHeader className='flex app-drag'>连接详情</ModalHeader>
        <ModalBody>
          <SettingItem title='连接建立时间'>{dayjs(connection.start).fromNow()}</SettingItem>
          <SettingItem title='规则'>
            {connection.rule}
            {connection.rulePayload ? `(${connection.rulePayload})` : ''}
          </SettingItem>
          <SettingItem title='代理链'>{[...connection.chains].reverse().join('>>')}</SettingItem>
          <SettingItem title='上传速度'>{calcTraffic(connection.uploadSpeed || 0)}/s</SettingItem>
          <SettingItem title='下载速度'>{calcTraffic(connection.downloadSpeed || 0)}/s</SettingItem>
          <SettingItem title='上传量'>{calcTraffic(connection.upload)}</SettingItem>
          <SettingItem title='下载量'>{calcTraffic(connection.download)}</SettingItem>
          <CopyableSettingItem
            title='连接类型'
            value={connection.metadata.type}
            displayName={`${connection.metadata.type}(${connection.metadata.network})`}
            prefix={['IN-TYPE']}
          />
          {connection.metadata.host && (
            <CopyableSettingItem
              title='主机'
              value={connection.metadata.host}
              prefix={['DOMAIN', 'DOMAIN-SUFFIX']}
            />
          )}
          {connection.metadata.sniffHost && (
            <CopyableSettingItem
              title='嗅探主机'
              value={connection.metadata.sniffHost}
              prefix={['DOMAIN', 'DOMAIN-SUFFIX']}
            />
          )}
          {connection.metadata.process && (
            <CopyableSettingItem
              title='进程名'
              value={connection.metadata.process}
              displayName={`${connection.metadata.process}${connection.metadata.uid ? `(${connection.metadata.uid})` : ''}`}
              prefix={['PROCESS-NAME']}
            />
          )}
          {connection.metadata.processPath && (
            <CopyableSettingItem
              title='进程路径'
              value={connection.metadata.processPath}
              prefix={['PROCESS-PATH']}
            />
          )}
          {connection.metadata.sourceIP && (
            <CopyableSettingItem
              title='来源IP'
              value={connection.metadata.sourceIP}
              prefix={['SRC-IP-CIDR']}
              suffix='/32'
            />
          )}
          {connection.metadata.destinationIP && (
            <CopyableSettingItem
              title='目标IP'
              value={connection.metadata.destinationIP}
              prefix={['IP-CIDR']}
              suffix='/32'
            />
          )}
          {connection.metadata.destinationGeoIP && (
            <CopyableSettingItem
              title='目标GeoIP'
              value={connection.metadata.destinationGeoIP}
              prefix={['GEOIP']}
            />
          )}
          {connection.metadata.destinationIPASN && (
            <CopyableSettingItem
              title='目标ASN'
              value={connection.metadata.destinationIPASN}
              prefix={['IP-ASN']}
            />
          )}
          {connection.metadata.sourcePort && (
            <CopyableSettingItem
              title='来源端口'
              value={connection.metadata.sourcePort}
              prefix={['SRC-PORT']}
            />
          )}
          {connection.metadata.destinationPort && (
            <CopyableSettingItem
              title='目标端口'
              value={connection.metadata.destinationPort}
              prefix={['DST-PORT']}
            />
          )}
          {connection.metadata.inboundIP && (
            <CopyableSettingItem
              title='入站IP'
              value={connection.metadata.inboundIP}
              prefix={['SRC-IP-CIDR']}
            />
          )}
          {connection.metadata.inboundPort && (
            <CopyableSettingItem
              title='入站端口'
              value={connection.metadata.inboundPort}
              prefix={['SRC-PORT']}
            />
          )}
          {connection.metadata.inboundName && (
            <CopyableSettingItem
              title='入站名称'
              value={connection.metadata.inboundName}
              prefix={['IN-NAME']}
            />
          )}
          {connection.metadata.inboundUser && (
            <CopyableSettingItem
              title='入站用户'
              value={connection.metadata.inboundUser}
              prefix={['IN-USER']}
            />
          )}

          <CopyableSettingItem
            title='DSCP'
            value={connection.metadata.dscp.toString()}
            prefix={['DSCP']}
          />

          {connection.metadata.remoteDestination && (
            <SettingItem title='远程目标'>{connection.metadata.remoteDestination}</SettingItem>
          )}
          {connection.metadata.dnsMode && (
            <SettingItem title='DNS模式'>{connection.metadata.dnsMode}</SettingItem>
          )}
          {connection.metadata.specialProxy && (
            <SettingItem title='特殊代理'>{connection.metadata.specialProxy}</SettingItem>
          )}
          {connection.metadata.specialRules && (
            <SettingItem title='特殊规则'>{connection.metadata.specialRules}</SettingItem>
          )}
        </ModalBody>
        <ModalFooter>
          <Button size='sm' variant='light' onPress={onClose}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConnectionDetailModal
