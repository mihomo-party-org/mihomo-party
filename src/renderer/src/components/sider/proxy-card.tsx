import { Button, Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import { mihomoProxies } from '@renderer/utils/ipc'
import { useMemo } from 'react'
import { MdTableChart } from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router-dom'
import useSWR from 'swr'

const ProxyCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/proxies')
  const { data: proxies = { proxies: {} } } = useSWR('mihomoProxies', mihomoProxies)

  const filtered = useMemo(() => {
    return Object.keys(proxies.proxies).filter((key) => 'all' in proxies.proxies[key])
  }, [proxies])

  return (
    <Card
      fullWidth
      className={`mb-2 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/proxies')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <MdTableChart
              className={`${match ? 'text-white' : 'text-foreground'} text-[24px] font-bold`}
            />
          </Button>
          <Chip
            classNames={
              match
                ? {
                    base: 'border-white',
                    content: 'text-white select-none'
                  }
                : {
                    base: 'border-primary',
                    content: 'text-primary select-none'
                  }
            }
            size="sm"
            variant="bordered"
            className="mr-3 mt-2"
          >
            {filtered.length}
          </Chip>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          代理组
        </h3>
      </CardFooter>
    </Card>
  )
}

export default ProxyCard
