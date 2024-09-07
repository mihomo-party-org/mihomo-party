import React from 'react'
import { Accordion, AccordionItem, Card, CardBody } from '@nextui-org/react'

interface Props {
  title?: string
  children?: React.ReactNode
}

const SettingCard: React.FC<Props> = (props) => {
  return !props.title ? (
    <Card className="m-2">
      <CardBody>{props.children}</CardBody>
    </Card>
  ) : (
    <Accordion isCompact className="my-2" variant="splitted">
      <AccordionItem hideIndicator keepContentMounted title={props.title}>
        {props.children}
      </AccordionItem>
    </Accordion>
  )
}

export default SettingCard
