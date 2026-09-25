import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'

const router = createBrowserRouter([{ path: '*', element: <AuthProvider><App /></AuthProvider> }])

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><RouterProvider router={router} /></ErrorBoundary></StrictMode>)
