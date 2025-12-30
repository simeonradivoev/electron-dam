import { useState, useEffect, useCallback } from 'react';

// Generic storage hook factory
function useStorage<T>(
  key: string,
  initialValue: T,
  storage: Storage,
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = storage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading from storage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        storage.setItem(key, JSON.stringify(valueToStore));
        // Dispatch custom event to notify other instances
        window.dispatchEvent(
          new CustomEvent('storageChange', {
            detail: {
              key,
              value: valueToStore,
              storage: storage === localStorage ? 'local' : 'session',
            },
          }),
        );
      } catch (error) {
        console.error(`Error writing to storage key "${key}":`, error);
      }
    },
    [key, storedValue, storage],
  );

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      console.log('Change' + e.key);
      if (e.key === key && e.storageArea === storage) {
        try {
          const newValue = e.newValue ? JSON.parse(e.newValue) : initialValue;
          setStoredValue(newValue);
        } catch (error) {
          console.warn(`Error parsing storage value for key "${key}":`, error);
        }
      }
    };

    const handleCustomStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.key === key) {
        setStoredValue(customEvent.detail.value);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storageChange', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storageChange', handleCustomStorageChange);
    };
  }, [key, storage, initialValue]);

  return [storedValue, setValue];
}

// useLocalStorage hook
function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  return useStorage(key, initialValue, localStorage);
}

// useSessionStorage hook
function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  return useStorage(key, initialValue, sessionStorage);
}
