import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import Layout from '../components/Layout'
import { useEffect, useState } from 'react'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    window.authAPI.isLoggedIn().then(loggedIn => {
      if (!loggedIn) {
        window.location.hash = '#/login'
      }
      setChecking(false)
    })
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
