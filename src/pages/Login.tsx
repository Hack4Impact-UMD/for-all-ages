import { useNavigate } from "react-router-dom"

export default function Login () {
    const navigate = useNavigate()

    return (
        <>
            <p>Login</p>
            <button onClick={()=>{navigate("/dashboard")}}>Dash</button>
        </>
    )
}