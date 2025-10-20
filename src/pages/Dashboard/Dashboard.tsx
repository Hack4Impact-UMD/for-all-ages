import Navbar from '../../components/Navbar'
import styles from './Dashboard.module.css'

export default function Dashboard () {
    return (
        <>
            <Navbar></Navbar>
            <p className={styles.dashboardText}>Dashboard</p>
        </>
    )
}