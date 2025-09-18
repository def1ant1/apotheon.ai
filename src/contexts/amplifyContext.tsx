import {
  createContext,
  useReducer,
  PropsWithChildren,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { Amplify } from 'aws-amplify'
import {
  signUp,
  signIn,
  signOut,
  SignUpOutput,
  confirmSignUp,
  resendSignUpCode,
  fetchAuthSession,
  fetchUserAttributes,
  ConfirmSignUpOutput,
  ResendSignUpCodeOutput,
} from 'aws-amplify/auth'
// CUSTOM COMPONENT
import { SplashScreen } from '@/components/splash-screen'

// CONFIGURATION SETTINGS
import awsConfig from '@/aws-exports'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsConfig.aws_user_pools_id,
      userPoolClientId: awsConfig.aws_user_pools_web_client_id,
    },
  },
})

// ==============================================================
interface User {
  id: string
  name: string
  role: string
  email: string
}

interface AuthState {
  user: null | User
  isInitialized: boolean
  isAuthenticated: boolean
}

interface AuthAction {
  type: 'INIT' | 'LOGOUT'
  payload?: { isAuthenticated: boolean; user: User | null }
}

// ==============================================================

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
        user: action.payload!.user,
        isAuthenticated: action.payload!.isAuthenticated,
      }

    case 'LOGOUT':
      return { ...state, isAuthenticated: false, user: null }

    default:
      return state
  }
}

interface ContextProps extends AuthState {
  method: string
  logout: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  resendCode: (email: string) => Promise<ResendSignUpCodeOutput>
  emailVerify: (email: string, code: string) => Promise<ConfirmSignUpOutput>
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<SignUpOutput>
}

// AUTH CONTEXT INITIALIZE
export const AuthContext = createContext({} as ContextProps)

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialAuthState)

  const checkCurrentUser = useCallback(async () => {
    try {
      const { tokens } = await fetchAuthSession()
      if (tokens) {
        const attribute = await fetchUserAttributes()
        dispatch({
          type: 'INIT',
          payload: {
            isAuthenticated: true,
            user: {
              role: 'admin',
              id: attribute.sub!,
              name: attribute.name!,
              email: attribute.email!,
            },
          },
        })
      } else {
        dispatch({
          type: 'INIT',
          payload: { isAuthenticated: false, user: null },
        })
      }
    } catch (error) {
      dispatch({
        type: 'INIT',
        payload: { isAuthenticated: false, user: null },
      })
    }
  }, [])

  useEffect(() => {
    checkCurrentUser()
  }, [])

  // USER LOGIN HANDLER
  const login = useCallback(async (email: string, password: string) => {
    try {
      const { isSignedIn } = await signIn({ username: email, password })
      if (isSignedIn) checkCurrentUser()
    } catch (error) {
      throw error // Propagate error for handling in the component
    }
  }, [])

  // USER REGISTER HANDLER
  const register = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      return signUp({
        username: email,
        password: password,
        options: {
          userAttributes: {
            email: email,
            given_name: firstName,
            family_name: lastName,
            name: `${firstName} ${lastName}`,
          },
        },
      })
    },
    []
  )

  // USER EMAIL VERIFY HANDLER
  const emailVerify = useCallback(async (email: string, code: string) => {
    return confirmSignUp({ confirmationCode: code, username: email })
  }, [])

  // RESEND CODE HANDLER
  const resendCode = useCallback(async (email: string) => {
    return resendSignUpCode({ username: email })
  }, [])

  // USER LOGOUT HANDLER
  const logout = useCallback(async () => {
    await signOut()
    dispatch({ type: 'LOGOUT' })
  }, [])

  const contextValue = useMemo(
    () => ({
      ...state,
      method: 'AMPLIFY',
      login,
      logout,
      register,
      resendCode,
      emailVerify,
    }),
    [state, login, logout, register, resendCode, emailVerify]
  )

  // SHOW LOADING
  if (!state.isInitialized) return <SplashScreen />

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
