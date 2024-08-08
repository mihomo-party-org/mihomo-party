import BasePage from '@renderer/components/base/base-page'
import GeoData from '@renderer/components/resources/geo-data'
import ProxyProvider from '@renderer/components/resources/proxy-provider'
import RuleProvider from '@renderer/components/resources/rule-provider'
const Resources: React.FC = () => {
  return (
    <BasePage title="外部资源">
      <GeoData />
      <ProxyProvider />
      <RuleProvider />
    </BasePage>
  )
}

export default Resources
