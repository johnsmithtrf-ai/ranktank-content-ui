import { useState } from 'react'
import Login from './Login'
import Dashboard from './Dashboard'
import { logout, getToken } from './api'

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => !!getToken())

  const handleLogin = () => {
    setLoggedIn(true)
  }

  const handleLogout = () => {
    logout()
    setLoggedIn(false)
  }

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />
  }

  return <Dashboard onLogout={handleLogout} />
}
