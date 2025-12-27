import { IconName } from '@blueprintjs/core';
import { hashKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { FileType } from 'shared/constants';
import { string } from 'zod/v3';

export function humanFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const num = size / 1024 ** i;
  const round = Math.round(num);
  const numString = round < 10 ? num.toFixed(2) : round < 100 ? num.toFixed(1) : round.toString();
  return `${numString} ${'KMGTPEZY'[i - 1]}B`;
}

export const formatDuration = (ms: number) => {
  if (ms < 0) ms = -ms;
  const time = {
    day: Math.floor(ms / 86400000),
    hour: Math.floor(ms / 3600000) % 24,
    minute: Math.floor(ms / 60000) % 60,
    second: Math.floor(ms / 1000) % 60,
    millisecond: Math.floor(ms) % 1000,
  };
  return Object.entries(time)
    .filter((val) => val[1] !== 0)
    .map(([key, val]) => `${val} ${key}${val !== 1 ? 's' : ''}`)
    .join(', ');
};

export function toggleElementMutable(array: any[], element: any) {
  const newArray = Array.from(array);

  const index = array.indexOf(element);
  if (index >= 0) {
    newArray.splice(index, 1);
  } else {
    newArray.push(element);
  }
  return newArray;
}

export function useSavedStateRaw(
  key: string,
  initialValue?: string,
): [data: string | undefined, setter: React.Dispatch<React.SetStateAction<string | undefined>>] {
  return useSavedState(
    key,
    initialValue,
    (v) => v,
    (v) => v,
  );
}

export function useSavedState<T>(
  key: string,
  initialValue: T,
  serializer?: (value: T) => string | undefined,
  deserializer?: (data: string) => T,
): [data: T, setter: React.Dispatch<React.SetStateAction<T>>] {
  const stateData = useState<T>(() => {
    const savedValue = localStorage.getItem(key);
    if (savedValue) {
      return deserializer ? deserializer(savedValue) : (JSON.parse(savedValue) as T);
    } else {
      return initialValue;
    }
  });

  return [
    stateData[0],
    (updated) => {
      if (updated instanceof Function) {
        const newData = updated(stateData[0]);
        if (serializer) {
          const serialized = serializer(newData);
          if (serialized === undefined) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, serialized);
          }
        } else {
          localStorage.setItem(key, JSON.stringify(newData));
        }

        stateData[1](newData);
      } else {
        if (serializer) {
          const serialized = serializer(updated);
          if (serialized === undefined) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, serialized);
          }
        } else {
          localStorage.setItem(key, JSON.stringify(updated));
        }
        stateData[1](updated);
      }
    },
  ];
}

export const FileTypeIcons = {
  [FileType.Audio]: 'music' as IconName,
  [FileType.Models]: 'cube' as IconName,
  [FileType.Textures]: 'media' as IconName,
  [FileType.Text]: 'document' as IconName,
  [FileType.Bundle]: 'box' as IconName,
};

export function isValidHttpUrl(string: string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

export function useObserveQueryCache() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const queryCache = queryClient.getQueryCache();

    const unsubscribe = queryCache.subscribe((event) => {
      const { meta, state, queryKey } = event.query;
      if (event.type === 'removed' && meta?.onRemoveFromCache) {
        (meta as any).onRemoveFromCache(state, queryKey);
      }
    });

    return unsubscribe;
  }, [queryClient]);
}

export const arraysEqual = <T>(lhs: T[] | undefined, rhs: T[] | undefined) => {
  if (!lhs && !rhs) {
    return true;
  }

  if (!rhs) {
    return false;
  }

  if (!lhs) {
    return false;
  }

  if (lhs.length !== rhs.length) {
    return false;
  }

  for (let index = 0; index < lhs.length; index += 1) {
    if (lhs[index] !== rhs[index]) {
      return false;
    }
  }

  return true;
};

export function useQueryData<T>(queryKey: readonly unknown[]): T | undefined {
  const queryClient = useQueryClient();
  const keyHash = hashKey(queryKey);

  return useSyncExternalStore(
    (onStoreChange) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === keyHash) {
          onStoreChange();
        }
      }),
    () => queryClient.getQueryData<T>(queryKey),
  );
}

export function useEvent(
  element: DocumentAndElementEventHandlers,
  channel: string,
  callback: (e: any) => void,
) {
  useEffect(() => {
    element.addEventListener(channel, callback);
    return () => element.removeEventListener(channel, callback as any);
  });
}
