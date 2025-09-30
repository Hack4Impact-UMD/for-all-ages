import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path={"/"} element={<Login></Login>}></Route>
          <Route path={"/dashboard"} element={<Dashboard></Dashboard>}></Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
