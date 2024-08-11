import { Button, Card, CardBody, CardFooter } from '@nextui-org/react'
import React from 'react'
import { FaLayerGroup } from 'react-icons/fa6'
import { useLocation, useNavigate } from 'react-router-dom'

const ResourceCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/resources')

  return (
    <Card
      className={`col-span-1 ${match ? 'bg-primary' : ''}`}
      isPressable
      onPress={() => navigate('/resources')}
    >
      <CardBody className="pb-1 pt-0 px-0">
        <div className="flex justify-between">
          <Button
            isIconOnly
            className="bg-transparent pointer-events-none"
            variant="flat"
            color="default"
          >
            <FaLayerGroup
              color="default"
              className={`${match ? 'text-white' : 'text-foreground'} text-[24px] font-bold`}
            />
          </Button>
        </div>
      </CardBody>
      <CardFooter className="pt-1">
        <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>
          外部资源
        </h3>
      </CardFooter>
    </Card>
  )
}

export default ResourceCard
