import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LoginSignup from './pages/Login/Login-Signup'
import Dashboard from './pages/Dashboard/Dashboard'

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path={"/"} element={<LoginSignup></LoginSignup>}></Route>
          <Route path={"/dashboard"} element={<Dashboard></Dashboard>}></Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
