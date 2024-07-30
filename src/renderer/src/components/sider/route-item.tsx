import { Button } from '@nextui-org/react'
import { IconType } from 'react-icons'
import { useLocation, useNavigate } from 'react-router-dom'

interface Props {
  title: string
  pathname: string
  icon: IconType
}

export default function RouteItem(props: Props): JSX.Element {
  const { pathname, icon: Icon, title } = props
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Button
      fullWidth
      color={location.pathname.includes(pathname) ? 'primary' : 'default'}
      variant={location.pathname.includes(pathname) ? 'solid' : 'light'}
      className="text-md mb-2"
      startContent={<Icon className="text-[20px]" />}
      onPress={() => navigate(pathname)}
    >
      <div className="w-full">{title}</div>
    </Button>
  )
}
