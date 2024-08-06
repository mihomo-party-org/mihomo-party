import { Button, Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import { mihomoRules } from '@renderer/utils/ipc'
import { IoGitNetwork } from 'react-icons/io5'
import { useLocation, useNavigate } from 'react-router-dom'
import useSWR from 'swr'

const RuleCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/rules')
  const { data: rules } = useSWR<IMihomoRulesInfo>('mihomoRules', mihomoRules, {
    refreshInterval: 5000
  })

  return (
    <Card
      className={`w-[50%] ml-1 mb-2 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/rules')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <IoGitNetwork
              color="default"
              className={`${match ? 'text-white' : 'text-foreground'} text-[20px]`}
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
            {rules?.rules?.length ?? 0}
          </Chip>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          规则
        </h3>
      </CardFooter>
    </Card>
  )
}

export default RuleCard
