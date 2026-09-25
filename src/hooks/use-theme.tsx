/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
type Theme = 'light' | 'dark'; const key = 'pdf-editor-theme'
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme, origin?: HTMLElement | null) => void; toggleTheme: (origin?: HTMLElement | null) => void }>({ theme: 'light', setTheme: () => {}, toggleTheme: () => {} })
export function ThemeProvider({ children }: { children: ReactNode }) { const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(key) === 'dark' ? 'dark' : 'light'))
  function setTheme(next: Theme, origin?: HTMLElement | null) { const apply = () => { setThemeState(next); localStorage.setItem(key, next); document.documentElement.classList.toggle('dark', next === 'dark') }; if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) { const rect = origin?.getBoundingClientRect(); const x = rect ? rect.left + rect.width / 2 : innerWidth / 2; const y = rect ? rect.top + rect.height / 2 : innerHeight / 2; document.documentElement.style.setProperty('--theme-x', `${x}px`); document.documentElement.style.setProperty('--theme-y', `${y}px`); document.startViewTransition(apply) } else apply() }
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])
  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme: (origin) => setTheme(theme === 'dark' ? 'light' : 'dark', origin) }}>{children}</ThemeContext.Provider> }
export const useTheme = () => useContext(ThemeContext)
