import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import React from 'react'
import { TbWorldCheck } from 'react-icons/tb'
import { useLocation, useNavigate } from 'react-router-dom'

const TestCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/tests')

  return (
    <Card
      className={`w-[50%] mr-1 mb-2 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/tests')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <TbWorldCheck
              color="default"
              className={`${match ? 'text-white' : 'text-foreground'} text-[20px] font-bold`}
            />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className={`select-none text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          测试
        </h3>
      </CardFooter>
    </Card>
  )
}

export default TestCard
