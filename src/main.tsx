import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import queryClient from '@/lib/query'
import { router } from './router'

function applyTheme() {
    const stored = localStorage.getItem('theme')
    const isDark =
        stored === 'dark' ||
        (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
}

applyTheme()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)

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
