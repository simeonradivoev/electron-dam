/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import Rand, { PRNG } from 'rand-seed';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export function getRandom<T>(arr: Array<T>, n: number, seed: string): Array<T> {
  const rand = new Rand(seed);
  const result = new Array<T>();
  let len = arr.length;
  const taken = arr.slice();
  for (let i = 0; i < Math.min(n, len); i += 1) {
    const x = Math.floor(rand.next() * len);
    result.push(taken[x]);
    // move last element to taken position and pop (no copy of array)
    taken[x] = taken[len - 1];
    len--;
    taken.pop();
  }
  return result;
}
