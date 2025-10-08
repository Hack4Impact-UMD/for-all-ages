import styles from './Login.module.css'
import { useNavigate } from "react-router-dom"

export default function Login () {
    const navigate = useNavigate()

    return (
        <>
            <p className={styles.loginText}>Login</p>
            <button onClick={()=>{navigate("/user/dashboard")}}>Dash</button>
        </>
    )
}