import React, { useRef } from 'react'
import { Input, InputProps } from '@nextui-org/react'
import { FaSearch } from 'react-icons/fa'

interface CollapseInputProps extends InputProps {
  title: string
}

const CollapseInput: React.FC<CollapseInputProps> = (props) => {
  const { title, ...inputProps } = props
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex">
      <Input
        size="sm"
        ref={inputRef}
        {...inputProps}
        style={{ paddingInlineEnd: 0 }}
        classNames={{
          inputWrapper: 'bg-transparent',
          input: `w-0 focus:w-[150px] bg-transparent transition-all duration-200`
        }}
        endContent={
          <FaSearch
            title={title}
            className="cursor-pointer text-lg text-default-500"
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.focus()
            }}
          />
        }
        onClick={(e) => {
          e.stopPropagation()
          inputRef.current?.focus()
        }}
      />
    </div>
  )
}

export default CollapseInput
