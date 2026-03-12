import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import queryClient from '@/lib/query'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'

const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
const setSystemThemeClass = () => {
    document.documentElement.classList.toggle('dark', darkModeMediaQuery.matches)
}

setSystemThemeClass()
darkModeMediaQuery.addEventListener('change', setSystemThemeClass)

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <RouterProvider router={router} />
                <Toaster />
            </TooltipProvider>
        </QueryClientProvider>
    </StrictMode>
)
