import './App.css'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import Login from './pages/Login/Login'
import UserDashboard from './pages/Dashboard/UserDashboard'
import AdminDashboard from './pages/Dashboard/AdminDashboard'

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path={"/"} element={<Login></Login>}></Route>

          <Route path="/user/*">
            <Route path="" element={<Navigate to="/user/dashboard" replace />} />
            <Route path="dashboard" element={<UserDashboard />} />
          </Route>

          <Route path="/admin/*">
            <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
          </Route>

          {/* <Route path={"/user/dashboard"} element={<Dashboard></Dashboard>}></Route>
          <Route path={"/admin/dashboard"} element={<Dashboard></Dashboard>}></Route> */}
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
