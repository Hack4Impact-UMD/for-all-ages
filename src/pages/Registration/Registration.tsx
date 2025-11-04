import styles from './Registration.module.css';
import logo from '../../assets/For all Ages high res logo 2022 (1).svg'
import { phoneNumberRegex } from '../../regex';

const Registration = () => {
  return (
    <>
      {/* Navbar */}
      <div id={styles.navbar}>
        <img id={styles.logo} src={logo} alt="For All Ages Logo"/>
        <p id={styles.title}>Registration Form</p>
      </div>

      {/* Form page */}
      <form id={styles.page}>

        <div id={styles.addr_container}>
          {/* Street Addresses */}
          <div id={styles.addr_street}>
            <label className={styles.sublabel}>
              <span className={styles.label}>Address</span>
              <input type="text" required/>
              Street Address
            </label>

            <label className={styles.sublabel}>
              <input type="text" required/>
              Street Address 2
            </label>
          </div>
          
          {/* City, State, Zip, Country */}
          <div id={styles.addr_details}>
            <div>
              <label className={styles.sublabel}>
                <input type="text" required/>
                City
              </label>
            </div>
            
            <div>
              <label className={styles.sublabel}>
                <input type="text" required/>
                State / Province
              </label>
            </div>
            
            <div>
              <label className={styles.sublabel}>
                <input type="text" required/>
                Postal / Zip Code
              </label>
            </div>

            <div>
              <label className={styles.sublabel}>
                <input type="text" required/>
                Country
              </label>
            </div>
          </div>
        </div>
        
        {/* Other Info */}
        <div className={styles.confirm}>
          <label className={styles.label}>
            Phone Number
            <input 
              type="tel" 
              pattern={phoneNumberRegex.source}
              placeholder='XXX-XXX-XXXX'
              required
            />
          </label>

          <label className={styles.label}>
            Confirm Phone Number
            <input type="tel" required placeholder='XXX-XXX-XXXX'/>
          </label>
        </div>
        
        <div className={styles.confirm}>
          <label className={styles.label}>
            Email
            <input type="email" required/>
          </label>

          <label className={styles.label}>
            Confirm Email
            <input type="email" required/>
          </label>
        </div>

        <label className={styles.label}>
          Date of Birth
          <input className={styles.dob} type="date" required/>
        </label>
        
        <label className={styles.label}>
          Preferred Pronouns
          <input className={styles.pronouns} type="text" required/>
        </label>

        <label className={styles.label}>
          How did you hear about this program?
          <select defaultValue="" required>
            <option value="" disabled></option>
            <option>Social Media</option>
            <option>Word-of-mouth</option>
            <option>Referral</option>
            <option>Returning member</option>
            <option>Advertisement</option>
          </select>
        </label>

        <label className={styles.label}>
          If you are a college student, what University are you attending?
          <input type="text" required/>
        </label>

        <label className={styles.label}>
          What are your interests? This will better help us pair you with your Tea-mate!
          <textarea id={styles.interests} rows={5} required/>
        </label>

        <label className={styles.label}>
          What type of tea do you prefer?

          <label>
            <input type="radio" id="black" name="tea" value="black" required />
            Black
          </label>

          <label htmlFor="green">
            <input type="radio" id="green" name="tea" value="green" required/>
            Green
          </label>

          
          <label htmlFor="herbal">
            <input type="radio" id="herbal" name="tea" value="herbal" required/>
            Herbal
          </label>

          <label htmlFor="variety">
            <input type="radio" id="variety" name="tea" value="variety" required/>
            Variety
          </label>
        </label>

        {/* Submit button */}
        <button id={styles.submit} type="submit">Submit</button>

      </form>
    </>
  )
};

export default Registration;