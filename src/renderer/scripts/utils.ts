import { IconName } from '@blueprintjs/core';
import { Highlight } from '@orama/highlight';
import { hashKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { FileType } from 'shared/constants';

export const highlighter = new Highlight();

export function humanFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const num = size / 1024 ** i;
  const round = Math.round(num);
  let numString: string;
  if (round < 10) numString = num.toFixed(2);
  else if (round < 100) numString = num.toFixed(1);
  else numString = round.toString();
  return `${numString} ${'KMGTPEZY'[i - 1]}B`;
}

export const formatDuration = (msi: number) => {
  let ms = msi;
  if (msi < 0) ms = -ms;
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

export function toggleElementMutable(array: unknown[], element: unknown) {
  const newArray = Array.from(array);

  const index = array.indexOf(element);
  if (index >= 0) {
    newArray.splice(index, 1);
  } else {
    newArray.push(element);
  }
  return newArray;
}

export const FileTypeIcons = {
  [FileType.Audio]: 'music' as IconName,
  [FileType.Models]: 'cube' as IconName,
  [FileType.Textures]: 'media' as IconName,
  [FileType.Text]: 'document' as IconName,
  [FileType.Bundle]: 'box' as IconName,
};

export const QueryKeys = {
  metadata: 'metadata',
  tags: 'tags',
  fileInfo: 'fileInfo',
  embeddings: 'embeddings',
};

export function isValidHttpUrl(string: string) {
  let url;
  try {
    url = new URL(string);
  } catch {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export function useEvent(element: Document, channel: string, callback: (e: unknown) => void) {
  useEffect(() => {
    element.addEventListener(channel, callback);
    return () =>
      element.removeEventListener(channel, callback as EventListenerOrEventListenerObject);
  });
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // prevent stack overflow

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function encodePeaks(peaks: number[][]): string {
  const channels = peaks.length;
  const { length } = peaks[0];

  // Header: [channels (1 byte), length (4 bytes)]
  const header = new Uint8Array(5);
  header[0] = channels;
  new DataView(header.buffer).setUint32(1, length, false);

  // Quantize + flatten
  const data = new Uint8Array(channels * length);
  let offset = 0;

  peaks.forEach((c) => {
    c.forEach((v) => {
      data[(offset += 1)] = Math.round(v * 127 + 128);
    });
  });

  // Combine
  const combined = new Uint8Array(header.length + data.length);
  combined.set(header, 0);
  combined.set(data, header.length);

  return uint8ToBase64(combined);
}

export function decodePeaks(encoded: string): number[][] {
  const bytes = base64ToUint8(encoded);

  const channels = bytes[0];
  const length = new DataView(bytes.buffer).getUint32(1, false);

  let offset = 5;
  const peaks: number[][] = [];

  for (let c = 0; c < channels; c += 1) {
    const channel = new Array<number>(length);
    for (let i = 0; i < length; i += 1) {
      channel[i] = (bytes[(offset += 1)] - 128) / 127;
    }
    peaks.push(channel);
  }

  return peaks;
}
