import { createContext, useContext, useState, useEffect } from 'react'

const UnitsContext = createContext({})

export function UnitsProvider({ children }) {
  const [units, setUnits] = useState(() => localStorage.getItem('cadence_units') || 'lbs')

  useEffect(() => {
    localStorage.setItem('cadence_units', units)
  }, [units])

  const convertWeight = (lbs) => {
    if (units === 'kg') return Math.round(lbs * 0.453592 * 10) / 10
    return lbs
  }

  const convertToLbs = (value) => {
    if (units === 'kg') return Math.round(value / 0.453592 * 10) / 10
    return value
  }

  const unitLabel = units

  return (
    <UnitsContext.Provider value={{ units, setUnits, convertWeight, convertToLbs, unitLabel }}>
      {children}
    </UnitsContext.Provider>
  )
}

export const useUnits = () => useContext(UnitsContext)
