import { createContext, useEffect, useReducer, PropsWithChildren, useCallback } from 'react'
import axios from 'axios'
// CUSTOM LOADING COMPONENT
import { LoadingProgress } from '@/components/loader'

const API_URL = 'http://localhost:5000'

// ==============================================================
interface User {
  id: string
  name: string
  email: string
}

interface AuthState {
  user: null | User
  isInitialized: boolean
  isAuthenticated: boolean
}

interface AuthAction {
  type: 'INIT' | 'LOGIN' | 'LOGOUT' | 'REGISTER'
  payload: { isAuthenticated: boolean; user: User | null }
}
// ==============================================================

const initialState: AuthState = {
  user: null,
  isInitialized: false,
  isAuthenticated: false,
}

const setSession = (accessToken: string | null) => {
  if (accessToken) {
    localStorage.setItem('accessToken', accessToken)
    axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`
  } else {
    localStorage.removeItem('accessToken')
    delete axios.defaults.headers.common.Authorization
  }
}

const reducer = (state: AuthState, action: AuthAction) => {
  switch (action.type) {
    case 'INIT':
      return {
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
      return {
        ...state,
        user: null,
        isAuthenticated: false,
      }

    case 'REGISTER':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
      }

    default:
      return state
  }
}

// ==============================================================
interface ContextProps extends AuthState {
  method: string
  logout: () => void
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
}
// ==============================================================

export const AuthContext = createContext({} as ContextProps)

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // USER LOGIN HANDLER
  const login = useCallback(async (email: string, password: string) => {
    const { data } = await axios.post(`${API_URL}/users/login`, {
      email,
      password,
    })
    setSession(data.token)
    dispatch({
      type: 'LOGIN',
      payload: { user: data, isAuthenticated: false },
    })
  }, [])

  // USER REGISTER HANDLER
  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data } = await axios.post(`${API_URL}/users`, {
      name,
      email,
      password,
    })
    setSession(data.token)
    dispatch({
      type: 'REGISTER',
      payload: { user: data, isAuthenticated: true },
    })
  }, [])

  // USER LOGOUT HANDLER
  const logout = () => {
    setSession(null)
    dispatch({
      type: 'LOGOUT',
      payload: { user: null, isAuthenticated: false },
    })
  }

  const checkCurrentUser = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('accessToken')

      if (accessToken) {
        setSession(accessToken)
        const { data } = await axios.get(`${API_URL}/users/profile`)
        dispatch({
          type: 'INIT',
          payload: { user: data, isAuthenticated: true },
        })
      } else {
        dispatch({
          type: 'INIT',
          payload: { user: null, isAuthenticated: false },
        })
      }
    } catch (err) {
      dispatch({
        type: 'INIT',
        payload: { user: null, isAuthenticated: false },
      })
    }
  }, [])

  useEffect(() => {
    checkCurrentUser()
  }, [])

  // show loading until not initialized
  if (!state.isInitialized) return <LoadingProgress />

  return (
    <AuthContext.Provider value={{ ...state, method: 'JWT', login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
