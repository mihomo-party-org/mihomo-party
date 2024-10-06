import { Button, Card, CardBody, CardFooter, Chip } from '@nextui-org/react'
import { MdOutlineAltRoute } from 'react-icons/md'
import { useLocation } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRules } from '@renderer/hooks/use-rules'
import { useAppConfig } from '@renderer/hooks/use-app-config'

const RuleCard: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { ruleCardStatus = 'col-span-1' } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/rules')
  const { rules } = useRules()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'rule'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${ruleCardStatus} rule-card`}
    >
      <Card
        fullWidth
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? 'scale-[0.97] tap-highlight-transparent' : ''}`}
      >
        <CardBody className="pb-1 pt-0 px-0">
          <div className="flex justify-between">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <MdOutlineAltRoute
                color="default"
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
              />
            </Button>
            <Chip
              classNames={
                match
                  ? {
                      base: 'border-primary-foreground',
                      content: 'text-primary-foreground'
                    }
                  : {
                      base: 'border-primary',
                      content: 'text-primary'
                    }
              }
              size="sm"
              variant="bordered"
              className="mr-2 mt-2"
            >
              {rules?.rules?.length ?? 0}
            </Chip>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            规则
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default RuleCard
