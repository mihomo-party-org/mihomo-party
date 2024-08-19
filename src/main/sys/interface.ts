import os from 'os'

export function getInterfaces(): NodeJS.Dict<NetworkInterfaceInfo[]> {
  return os.networkInterfaces()
}
