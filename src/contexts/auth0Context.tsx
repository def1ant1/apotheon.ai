import { createContext, useEffect, useReducer, PropsWithChildren, useCallback } from 'react'
import { Auth0Client, LogoutOptions, PopupLoginOptions, User } from '@auth0/auth0-spa-js'
// CUSTOM COMPONENT
import { LoadingProgress } from '@/components/loader'

// ==============================================================
interface AuthState {
  user: User | null
  isInitialized: boolean
  isAuthenticated: boolean
}

interface AuthAction {
  type: 'INIT' | 'LOGIN' | 'LOGOUT'
  payload: { isAuthenticated: boolean; user: User | null }
}
// ==============================================================

const auth0Client = new Auth0Client({
  clientId: import.meta.env.VITE_APP_AUTH0_CLIENT_ID!,
  domain: import.meta.env.VITE_APP_AUTH0_DOMAIN!,
  authorizationParams: { redirect_uri: window.location.origin },
})

const initialAuthState: AuthState = {
  user: null,
  isInitialized: false,
  isAuthenticated: false,
}

const reducer = (state: AuthState, action: AuthAction) => {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        isInitialized: true,
        user: action.payload.user,
        isAuthenticated: action.payload.isAuthenticated,
      }

    case 'LOGIN':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
      }

    case 'LOGOUT':
      return { ...state, isAuthenticated: false, user: null }

    default:
      return state
  }
}

// ==============================================================
interface ContextProps extends AuthState {
  method: string
  logout: (options?: LogoutOptions) => void
  loginWithPopup: (options?: PopupLoginOptions) => Promise<void>
}
// ==============================================================

export const AuthContext = createContext({} as ContextProps)

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialAuthState)

  // LOGIN HANDLE
  const loginWithPopup = useCallback(async (options?: PopupLoginOptions) => {
    await auth0Client.loginWithPopup(options)

    const isAuthenticated = await auth0Client.isAuthenticated()

    if (isAuthenticated) {
      const user = await auth0Client.getUser()

      dispatch({
        type: 'LOGIN',
        payload: {
          isAuthenticated: true,
          user: {
            id: user?.sub,
            name: user?.name,
            email: user?.email,
            avatar: user?.picture,
          },
        },
      })
    }
  }, [])

  // LOGOUT HANDLE
  const logout = useCallback((options?: LogoutOptions) => {
    auth0Client.logout(options)
    dispatch({
      type: 'LOGOUT',
      payload: { isAuthenticated: false, user: null },
    })
  }, [])

  const checkCurrentUser = useCallback(async () => {
    try {
      await auth0Client.checkSession()
      const isAuthenticated = await auth0Client.isAuthenticated()

      if (isAuthenticated) {
        const user = await auth0Client.getUser()

        const payload = {
          isAuthenticated,
          user: {
            role: 'admin',
            id: user?.sub,
            name: user?.name,
            email: user?.email,
            avatar: user?.picture,
          },
        }

        dispatch({ type: 'INIT', payload })
      } else {
        dispatch({
          type: 'INIT',
          payload: { isAuthenticated, user: null },
        })
      }
    } catch (err) {
      dispatch({
        type: 'INIT',
        payload: { isAuthenticated: false, user: null },
      })
    }
  }, [])

  useEffect(() => {
    checkCurrentUser()
  }, [])

  if (!state.isInitialized) return <LoadingProgress />

  return (
    <AuthContext.Provider value={{ ...state, method: 'AUTH0', loginWithPopup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
