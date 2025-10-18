import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Registration from './pages/Registration/Registration'

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path={"/"} element={<Login></Login>}></Route>
          <Route path={"/dashboard"} element={<Dashboard></Dashboard>}></Route>
          <Route path={"/registration"} element={<Registration></Registration>}></Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
