import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Login.module.css'

function Login() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = () => {
    if (username.trim() && password.trim()) {
      navigate('/dashboard')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoSection}>
        <div className={styles.logoCard}>
          <img 
            src="/faa logo.png" 
            alt="For All Ages Logo" 
            className={styles.logoImage}
          />
        </div>
      </div>
      
      <div className={styles.formSection}>
        <div className={styles.formCard}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'login' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Log-In
            </button>
            <span className={styles.tabDivider}>|</span>
            <button
              className={`${styles.tab} ${activeTab === 'signup' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('signup')}
            >
              Sign Up
            </button>
          </div>
          
          {activeTab === 'login' ? (
            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="username" className={styles.label}>Username</label>
                <input
                  type="text"
                  id="username"
                  className={styles.input}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <input
                  type="password"
                  id="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <button
                className={`${styles.submitButton} ${!username.trim() || !password.trim() ? styles.disabled : ''}`}
                onClick={handleLogin}
                disabled={!username.trim() || !password.trim()}
              >
                Log-In
              </button>
            </div>
          ) : (
            <div className={styles.form}>
              <p className={styles.signupMessage}>Sign up!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login