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
