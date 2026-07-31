import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Home from './pages/Home.jsx'
import Convert from './pages/Convert.jsx'
import Tool from './pages/Tool.jsx'
import Developers from './pages/Developers.jsx'
import Embed from './pages/Embed.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <ErrorBoundary>
              <Home />
            </ErrorBoundary>
          }
        />
        <Route
          path="convert/:pair"
          element={
            <ErrorBoundary>
              <Convert />
            </ErrorBoundary>
          }
        />
        <Route
          path="tools/:tool"
          element={
            <ErrorBoundary>
              <Tool />
            </ErrorBoundary>
          }
        />
        <Route path="developers" element={<Developers />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="embed" element={<Embed />} />
    </Routes>
  )
}
