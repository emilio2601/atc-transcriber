import React, { createContext, useContext, ReactNode } from "react"

interface AuthContextType {
  loggedIn: boolean
  userEmail: string | null
}

const AuthContext = createContext<AuthContextType>({
  loggedIn: false,
  userEmail: null,
})

export function AuthProvider({
  children,
  loggedIn,
  userEmail,
}: {
  children: ReactNode
  loggedIn: boolean
  userEmail: string | null
}) {
  return (
    <AuthContext.Provider value={{ loggedIn, userEmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
