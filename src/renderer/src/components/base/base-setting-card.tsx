import React from 'react'
import { Accordion, AccordionItem, Card, CardBody } from '@nextui-org/react'

interface Props {
  title?: string
  children?: React.ReactNode
  className?: string
}

const SettingCard: React.FC<Props> = (props) => {
  return !props.title ? (
    <Card className={`${props.className} m-2`}>
      <CardBody>{props.children}</CardBody>
    </Card>
  ) : (
    <Accordion isCompact className={`${props.className} my-2`} variant="splitted" {...props}>
      <AccordionItem
        className="data-[open=true]:pb-2"
        hideIndicator
        keepContentMounted
        title={props.title}
      >
        {props.children}
      </AccordionItem>
    </Accordion>
  )
}

export default SettingCard
