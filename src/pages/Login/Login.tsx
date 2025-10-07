import styles from './Login.module.css'
import { useNavigate } from "react-router-dom"
import SignupLoginForm from './SignupLoginForm'

export default function Login () {
    const navigate = useNavigate()

    return (
        <>
            <SignupLoginForm />
            <button onClick={()=>{navigate("/dashboard")}}>Dash</button>
        </>
    )
}