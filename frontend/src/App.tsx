import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { RealtimeProvider } from './context/RealtimeContext'

function App() {
  return (
    <RealtimeProvider>
      <RouterProvider router={router} />
    </RealtimeProvider>
  )
}

export default App