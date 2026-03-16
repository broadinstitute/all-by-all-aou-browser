import { useState, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string | undefined, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const initialValueRef = useRef(initialValue);

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined' || !key) return initialValueRef.current;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValueRef.current;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValueRef.current;
    }
  });

  // Sync state if the key changes (e.g., navigating to a different phenotype)
  useEffect(() => {
    if (typeof window === 'undefined' || !key) {
      setStoredValue(initialValueRef.current);
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(item ? JSON.parse(item) : initialValueRef.current);
    } catch (error) {
      setStoredValue(initialValueRef.current);
    }
  }, [key]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined' || !key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export function useLocalStorageSet(key: string | undefined, initialValue: Set<string>): [Set<string>, React.Dispatch<React.SetStateAction<Set<string>>>] {
  const initialValueRef = useRef(initialValue);

  const [storedValue, setStoredValue] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !key) return initialValueRef.current;
    try {
      const item = window.localStorage.getItem(key);
      return item ? new Set(JSON.parse(item)) : initialValueRef.current;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValueRef.current;
    }
  });

  // Sync state if the key changes
  useEffect(() => {
    if (typeof window === 'undefined' || !key) {
      setStoredValue(initialValueRef.current);
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(item ? new Set(JSON.parse(item)) : initialValueRef.current);
    } catch (error) {
      setStoredValue(initialValueRef.current);
    }
  }, [key]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined' || !key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(Array.from(storedValue)));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
