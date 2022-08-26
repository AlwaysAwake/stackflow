import React, {
  createContext,
  FC,
  ReactElement,
  useContext,
  useMemo,
  useState,
} from 'react'

interface AnimationContextProps {
  shouldAnimate: boolean
  activeAnimation: (params: boolean) => void
}

const AnimationContext = createContext<AnimationContextProps>(
  null as unknown as any
)

interface ProviderAnimationProps {
  children: React.ReactNode
}

export const ProviderAnimation: FC<ProviderAnimationProps> = ({
  children,
}: ProviderAnimationProps): ReactElement => {
  const [animation, activeAnimation] = useState(true)
  const shouldAnimate = useMemo(() => animation, [animation])

  return (
    <AnimationContext.Provider value={{ shouldAnimate, activeAnimation }}>
      {children}
    </AnimationContext.Provider>
  )
}

export const useAnimationContext = () => useContext(AnimationContext)
