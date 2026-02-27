import { useStore } from './store'
import LoginScreen from './components/LoginScreen'
import AppShell from './components/AppShell'

export default function App(): React.JSX.Element {
  const connected = useStore((s) => s.connected)

  if (!connected) {
    return <LoginScreen />
  }

  return <AppShell />
}
