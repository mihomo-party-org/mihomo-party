import { Button, Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import { IoGitNetwork } from 'react-icons/io5'
import { useLocation, useNavigate } from 'react-router-dom'

export default function RuleCard(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Card
      className={`w-[50%] mr-1 mb-2 ${location.pathname.includes('/rules') ? 'bg-primary' : ''}`}
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
            <IoGitNetwork color="default" className="text-[20px]" />
          </Button>
          <Chip size="sm" color="secondary" variant="bordered" className="mr-3 mt-2">
            1103
          </Chip>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className="select-none text-md font-bold">规则</h3>
      </CardFooter>
    </Card>
  )
}
