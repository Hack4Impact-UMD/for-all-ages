import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Login.module.css'

function LoginSignup() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ 
    username: '', 
    password: '', 
    firstName: '', 
    lastName: '', 
    email: '', 
    confirmPassword: '' 
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tab === 'login') navigate('/dashboard')
    else console.log('Sign Up:', form)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const isLoginValid = form.username && form.password
  const isSignupValid = form.firstName && form.lastName && form.email && form.password && form.confirmPassword && form.password === form.confirmPassword

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
              className={`${styles.tab} ${tab === 'login' ? styles.activeTab : ''}`}
              onClick={() => setTab('login')}
            >
              Log-In
            </button>
            <span className={styles.tabDivider}>|</span>
            <button
              className={`${styles.tab} ${tab === 'signup' ? styles.activeTab : ''}`}
              onClick={() => setTab('signup')}
            >
              Sign Up
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className={styles.form}>
            {tab === 'login' ? (
              <>
                <div className={styles.inputGroup}>
                  <label htmlFor="username" className={styles.label}>Username</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    className={styles.input}
                    value={form.username}
                    onChange={handleChange}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label htmlFor="password" className={styles.label}>Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className={styles.input}
                    value={form.password}
                    onChange={handleChange}
                  />
                </div>
                
                <button
                  type="submit"
                  className={`${styles.submitButton} ${!isLoginValid ? styles.disabled : ''}`}
                  disabled={!isLoginValid}
                >
                  Log-In
                </button>
              </>
            ) : (
              <>
                <div className={styles.inputGroup}>
                  <label htmlFor="firstName" className={styles.label}>First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    className={styles.input}
                    value={form.firstName}
                    onChange={handleChange}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label htmlFor="lastName" className={styles.label}>Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    className={styles.input}
                    value={form.lastName}
                    onChange={handleChange}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label htmlFor="email" className={styles.label}>Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className={styles.input}
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label htmlFor="signupPassword" className={styles.label}>Password</label>
                  <input
                    type="password"
                    id="signupPassword"
                    name="password"
                    className={styles.input}
                    value={form.password}
                    onChange={handleChange}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className={styles.input}
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                  {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                    <div className={styles.error}>Passwords don't match</div>
                  )}
                </div>
                
                <button
                  type="submit"
                  className={`${styles.submitButton} ${!isSignupValid ? styles.disabled : ''}`}
                  disabled={!isSignupValid}
                >
                  Sign Up
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginSignup