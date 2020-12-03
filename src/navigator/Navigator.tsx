import { Observer, useObserver } from 'mobx-react-lite'
import qs from 'querystring'
import React, { memo, useCallback, useEffect, useRef } from 'react'
import { HashRouter, matchPath, useHistory, useLocation } from 'react-router-dom'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import styled from '@emotion/styled'

import { NavigatorTheme } from '../types'
import { appendSearch, generateScreenInstanceId } from '../utils'
import { Card } from './components'
import { NavigatorOptionsProvider, useNavigatorOptions } from './contexts'
import { useHistoryPopEffect, useHistoryPushEffect, useHistoryReplaceEffect } from './hooks/useHistoryEffect'
import store, {
  addScreenInstanceAfter,
  increaseScreenInstancePointer,
  Screen,
  ScreenInstance,
  setScreenInstanceIn,
  setScreenInstancePointer,
} from './store'

const DEFAULT_CUPERTINO_ANIMATION_DURATION = 350
const DEFAULT_ANDROID_ANIMATION_DURATION = 270

/**
 * Navigator가 이미 초기화되었는지 확인
 * 한 개의 history stack을 사용하기 때문에, 한 개의 앱에는 한 개의 Navigator만 허용
 */
let isNavigatorInitialized = false

interface NavigatorProps {
  /**
   * 테마 (기본값: Web)
   */
  theme?: NavigatorTheme

  /**
   * 애니메이션 지속시간
   */
  animationDuration?: number

  /**
   * 빌트인 된 react-router-dom의 HashRouter를 없애고, 사용자가 직접 Router를 셋팅합니다
   */
  useCustomRouter?: boolean

  /**
   * 닫기 버튼을 눌렀을때 해당 콜백이 호출됩니다
   */
  onClose?: () => void

  /**
   * 네비게이션의 깊이가 변할때마다 해당 콜백이 호출됩니다
   */
  onDepthChange?: (depth: number) => void
}
const Navigator: React.FC<NavigatorProps> = (props) => {
  let h = (
    <NavigatorOptionsProvider
      value={{
        theme: props.theme ?? 'Android',
        animationDuration:
          props.animationDuration ??
          (() => {
            switch (props.theme ?? 'Android') {
              case 'Cupertino':
                return DEFAULT_CUPERTINO_ANIMATION_DURATION
              case 'Android':
                return DEFAULT_ANDROID_ANIMATION_DURATION
            }
          })(),
      }}>
      <NavigatorScreens onClose={props.onClose} onDepthChange={props.onDepthChange}>
        {props.children}
      </NavigatorScreens>
    </NavigatorOptionsProvider>
  )

  if (!props.useCustomRouter) {
    h = <HashRouter>{h}</HashRouter>
  }

  return h
}

const NavigatorScreens: React.FC<NavigatorProps> = (props) => {
  const location = useLocation()
  const history = useHistory()
  const depth = useObserver(() => store.screenInstancePointer)

  const pushScreen = useCallback(
    ({
      screenId,
      screenInstanceId,
      present,
      as,
    }: {
      screenId: string
      screenInstanceId: string
      present: boolean
      as: string
    }) => {
      const nextPointer = store.screenInstances.findIndex((screenInstance) => screenInstance.id === screenInstanceId)

      if (nextPointer === -1) {
        addScreenInstanceAfter(store.screenInstancePointer, { screenId, screenInstanceId, present, as })
        increaseScreenInstancePointer()
      } else {
        setScreenInstancePointer(nextPointer)
      }
    },
    []
  )

  const replaceScreen = useCallback(
    ({ screenId, screenInstanceId, as }: { screenId: string; screenInstanceId: string; as: string }) => {
      addScreenInstanceAfter(store.screenInstancePointer - 1, {
        screenId,
        screenInstanceId,
        present: false,
        as,
      })
    },
    []
  )

  const popScreen = useCallback(
    ({ depth, targetScreenInstanceId }: { depth: number; targetScreenInstanceId?: string }) => {
      if (targetScreenInstanceId) {
        setTimeout(() => store.screenInstancePromises.get(targetScreenInstanceId)?.(null), 0)
      }
      setScreenInstancePointer(store.screenInstancePointer - depth)
    },
    []
  )

  useEffect(() => {
    if (isNavigatorInitialized) {
      throw new Error('한 개의 앱에는 한 개의 Navigator만 허용됩니다')
    }

    const [, search] = location.search.split('?')
    const _si = generateScreenInstanceId()

    history.replace(location.pathname + '?' + appendSearch(search, { _si }))

    isNavigatorInitialized = true

    return () => {
      isNavigatorInitialized = false
    }
  }, [])

  useEffect(() => {
    if (!location.search) {
      return
    }
    const [, search] = location.search.split('?')
    const _si = qs.parse(search)?._si as string | undefined

    if (!_si) {
      return
    }
    if (store.screenInstances.length > 0) {
      return
    }

    let matchScreen: Screen | null = null

    for (const screen of store.screens.values()) {
      if (matchPath(location.pathname, { exact: true, path: screen.path })) {
        matchScreen = screen
        break
      }
    }

    if (matchScreen) {
      pushScreen({
        screenId: matchScreen.id,
        screenInstanceId: _si,
        present: false,
        as: location.pathname,
      })
    }
  }, [location.search])

  useEffect(() => {
    if (depth > -1) {
      props.onDepthChange?.(depth)
    }
  }, [depth])

  useHistoryPushEffect(
    (location) => {
      let matchScreen: Screen | null = null

      for (const screen of store.screens.values()) {
        if (matchPath(location.pathname, { exact: true, path: screen.path })) {
          matchScreen = screen
          break
        }
      }

      const [, search] = location.search.split('?')

      const screenInstanceId = qs.parse(search)?._si as string | undefined
      const present = qs.parse(search)?._present as string | undefined

      if (matchScreen && screenInstanceId) {
        pushScreen({
          screenId: matchScreen.id,
          screenInstanceId,
          present: present === 'true',
          as: location.pathname,
        })
      } else {
        setScreenInstanceIn(store.screenInstancePointer, (screenInstance) => ({
          ...screenInstance,
          nestedRouteCount: screenInstance.nestedRouteCount + 1,
        }))
      }
    },
    [pushScreen]
  )

  useHistoryReplaceEffect(
    (location) => {
      let matchScreen: Screen | null = null

      for (const screen of store.screens.values()) {
        if (matchPath(location.pathname, { exact: true, path: screen.path })) {
          matchScreen = screen
          break
        }
      }

      const [, search] = location.search.split('?')
      const screenInstanceId = qs.parse(search)?._si as string | undefined

      if (matchScreen && screenInstanceId) {
        replaceScreen({
          screenId: matchScreen.id,
          screenInstanceId,
          as: location.pathname,
        })
      }
    },
    [replaceScreen]
  )

  useHistoryPopEffect(
    {
      backward(location) {
        let matchScreen: Screen | null = null

        for (const screen of store.screens.values()) {
          if (matchPath(location.pathname, { exact: true, path: screen.path })) {
            matchScreen = screen
            break
          }
        }

        const [, search] = location.search.split('?')
        const screenInstanceId = qs.parse(search)?._si as string | undefined

        if (matchScreen && screenInstanceId) {
          const nextPointer = store.screenInstances.findIndex(
            (screenInstance) => screenInstance.id === screenInstanceId
          )

          setScreenInstanceIn(store.screenInstancePointer, (screenInstance) => ({
            ...screenInstance,
            nestedRouteCount: 0,
          }))
          popScreen({
            depth: store.screenInstancePointer - nextPointer,
            targetScreenInstanceId: screenInstanceId,
          })
        } else if (store.screenInstances[store.screenInstancePointer]?.nestedRouteCount === 0) {
          popScreen({
            depth: 1,
          })
        } else {
          setScreenInstanceIn(store.screenInstancePointer, (screenInstance) => ({
            ...screenInstance,
            nestedRouteCount: screenInstance.nestedRouteCount - 1,
          }))
        }
      },
      forward(location) {
        let screen: Screen | null = null

        for (const s of store.screens.values()) {
          if (matchPath(location.pathname, { exact: true, path: s.path })) {
            screen = s
            break
          }
        }

        const [, search] = location.search.split('?')

        const screenInstanceId = qs.parse(search)?._si as string | undefined
        const present = qs.parse(search)?._present as string | undefined

        if (screen && screenInstanceId) {
          pushScreen({
            screenId: screen.id,
            screenInstanceId,
            present: present === 'true',
            as: location.pathname,
          })
        } else {
          setScreenInstanceIn(store.screenInstancePointer, (screenInstance) => ({
            ...screenInstance,
            nestedRouteCount: screenInstance.nestedRouteCount + 1,
          }))
        }
      },
    },
    [popScreen, pushScreen]
  )

  const onClose = () => {
    props.onClose?.()
  }

  return (
    <Root>
      {props.children}
      <TransitionGroup>
        <Observer>
          {() => (
            <>
              {store.screenInstances.map((screenInstance, index) => (
                <Transition
                  key={index}
                  screenInstance={screenInstance}
                  screenInstanceIndex={index}
                  isRoot={index === 0}
                  isTop={index === store.screenInstancePointer}
                  onClose={onClose}
                />
              ))}
            </>
          )}
        </Observer>
      </TransitionGroup>
    </Root>
  )
}

const Root = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  user-select: none;
`

interface TransitionProps {
  screenInstance: ScreenInstance
  screenInstanceIndex: number
  isRoot: boolean
  isTop: boolean
  onClose: () => void
}
const Transition: React.FC<TransitionProps> = memo((props) => {
  const navigatorOptions = useNavigatorOptions()
  const nodeRef = useRef<HTMLDivElement>(null)

  return (
    <Observer>
      {() => {
        const { Component } = store.screens.get(props.screenInstance.screenId)!
        return (
          <CSSTransition
            key={props.screenInstance.id}
            nodeRef={nodeRef}
            timeout={navigatorOptions.animationDuration}
            in={props.screenInstanceIndex <= store.screenInstancePointer}
            unmountOnExit>
            <Card
              nodeRef={nodeRef}
              screenPath={store.screens.get(props.screenInstance.screenId)!.path}
              screenInstanceId={props.screenInstance.id}
              isRoot={props.screenInstanceIndex === 0}
              isTop={
                props.screenInstanceIndex >= store.screenInstancePointer ||
                (store.screenInstances.length > props.screenInstanceIndex + 1 &&
                  store.screenInstances[props.screenInstanceIndex + 1].present)
              }
              isPresent={props.screenInstance.present}
              onClose={props.onClose}>
              <Component
                as={props.screenInstance.as}
                screenInstanceId={props.screenInstance.id}
                isTop={props.isTop}
                isRoot={props.isRoot}
              />
            </Card>
          </CSSTransition>
        )
      }}
    </Observer>
  )
})

export default Navigator
