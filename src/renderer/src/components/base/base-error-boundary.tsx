import { Button } from '@nextui-org/react'
import { ReactNode } from 'react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'

const ErrorFallback = ({ error }: FallbackProps): JSX.Element => {
  return (
    <div className="p-4">
      <h2 className="my-2 text-lg font-bold">
        {'应用崩溃了 :( 请将以下信息提交给开发者以排查错误'}
      </h2>

      <Button
        size="sm"
        color="primary"
        variant="flat"
        onPress={() => open('https://github.com/mihomo-party-org/mihomo-party/issues/new/choose')}
      >
        GitHub
      </Button>
      <Button
        size="sm"
        color="primary"
        variant="flat"
        className="ml-2"
        onPress={() => open('https://t.me/mihomo_party')}
      >
        Telegram
      </Button>

      <Button
        size="sm"
        variant="flat"
        className="ml-2"
        onPress={() =>
          navigator.clipboard.writeText('```\n' + error.message + '\n' + error.stack + '\n```')
        }
      >
        复制报错信息
      </Button>

      <p className="my-2">{error.message}</p>

      <details title="Error Stack">
        <summary>Error Stack</summary>
        <pre>{error.stack}</pre>
      </details>
    </div>
  )
}

interface Props {
  children?: ReactNode
}

const BaseErrorBoundary = (props: Props): JSX.Element => {
  return <ErrorBoundary FallbackComponent={ErrorFallback}>{props.children}</ErrorBoundary>
}

export default BaseErrorBoundary
