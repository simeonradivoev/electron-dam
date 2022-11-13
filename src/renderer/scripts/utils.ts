import { IconName } from '@blueprintjs/core';
import { FileType } from 'shared/constants';

export default function humanFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const num = size / 1024 ** i;
  const round = Math.round(num);
  const numString =
    round < 10
      ? num.toFixed(2)
      : round < 100
      ? num.toFixed(1)
      : round.toString();
  return `${numString} ${'KMGTPEZY'[i - 1]}B`;
}

export const FileTypeIcons = {
  [FileType.Audio]: 'music' as IconName,
  [FileType.Models]: 'cube' as IconName,
  [FileType.Textures]: 'media' as IconName,
  [FileType.Text]: 'document' as IconName,
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
