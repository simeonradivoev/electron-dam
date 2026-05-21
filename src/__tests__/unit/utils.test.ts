import {
  supportedFilesMatch,
  audioMediaFormatsMatch,
  imageMediaFormatsMatch,
} from '../../main/util';

describe('Tests for file format matching functions', () => {
  const testCases = [
    [
      // completely unsupported
      '.ts',
      '.TS',
      '.Ts',
      '.nif',
      '.kf',
      '.unitypackage',
      '.txt',
      '.docx',
      '.doc',
      '.csv',
      '.dat',
      '.dll',
      '.DLL',
      '.psd',
      '.json',
      '.JSON',
    ],
    // different audio formats
    ['.mp3', '.MP3', '.Mp3', '.ogg', '.OGG', '.flac', '.FLAC', '.wav', '.WAV'],
    // different image formats
    ['.bmp', '.jpeg', '.jpg', '.pnG', '.GIF', '.svg', '.iCo', '.Webp', '.WEBP'],
  ];

  const eachCb = (item: string) => `some/path/file${item}`;

  test.each(testCases[0].map(eachCb))('should return "false" for %s', (a) => {
    expect(supportedFilesMatch(a)).toBeFalsy();
  });
  test.each(testCases[1].map(eachCb))('should return "true" for %s', (a) => {
    expect(audioMediaFormatsMatch(a)).toBeTruthy();
  });
  test.each(testCases[2].map(eachCb))('should return "true" for %s', (a) => {
    expect(imageMediaFormatsMatch(a)).toBeTruthy();
  });
});
