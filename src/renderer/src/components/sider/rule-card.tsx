import { Button, Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import { mihomoRules } from '@renderer/utils/ipc'
import { MdOutlineAltRoute } from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useSWR from 'swr'

const RuleCard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.pathname.includes('/rules')
  const { data: rules } = useSWR<IMihomoRulesInfo>('mihomoRules', mihomoRules, {
    refreshInterval: 5000
  })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: 'rule'
  })

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className="col-span-1"
    >
      <Card
        fullWidth
        className={`col-span-1 ${match ? 'bg-primary' : ''}`}
        isPressable
        onPress={() => navigate('/rules')}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div ref={setNodeRef} {...attributes} {...listeners} className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <MdOutlineAltRoute
                color="default"
                className={`${match ? 'text-white' : 'text-foreground'} text-[24px]`}
              />
            </Button>
            <Chip
              classNames={
                match
                  ? {
                      base: 'border-white',
                      content: 'text-white'
                    }
                  : {
                      base: 'border-primary',
                      content: 'text-primary'
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
          <h3 className={`text-md font-bold ${match ? 'text-white' : 'text-foreground'}`}>规则</h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default RuleCard
