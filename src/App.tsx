import { AnimatePresence, motion } from 'framer-motion'
import { Background } from './components/Background'
import { Landing } from './components/Landing'
import { Briefing, Preparing } from './components/Preparing'
import { Results } from './components/Results'
import { TestScreen } from './components/TestScreen'
import { Logo, ThemeToggle } from './components/ui'
import { useTest } from './store'

export default function App() {
  const { phase, quit } = useTest()
  const inTest = phase === 'test'
  return (
    <>
      <Background />
      <div className="relative z-[1] flex min-h-screen flex-col px-4 sm:px-6">
        {!inTest && (
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-5">
            <Logo onClick={phase === 'preparing' ? undefined : quit} />
            <ThemeToggle />
          </header>
        )}
        <main className={`flex flex-1 flex-col ${inTest ? 'pt-2' : ''}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-1 flex-col"
            >
              {phase === 'landing' && <Landing />}
              {phase === 'preparing' && <Preparing />}
              {phase === 'briefing' && <Briefing />}
              {phase === 'test' && <TestScreen />}
              {phase === 'results' && <Results />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  )
}
