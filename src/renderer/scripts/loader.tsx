/* eslint-disable react/no-unknown-property */
/* eslint-disable no-restricted-syntax */
import { useQuery } from '@tanstack/react-query';
import { normalize } from 'pathe';
import { useState } from 'react';

async function loadModel(info: FileInfo): Promise<string> {
  return Promise.resolve(normalize(info.path));
}

function loadImage(info: FileInfo): Promise<string> {
  return Promise.resolve(`app://${normalize(info.path)}`);
}

function loadAudio(info: FileInfo): Promise<{ url: string; duration?: number }> {
  return Promise.resolve({
    url: `app://${normalize(info.path)}`,
    duration: info.audioMetadata?.format.duration,
  });
}

const modelLoaders = new Map<string, (fileInfo: FileInfo) => Promise<string>>([
  ['.obj', loadModel],
  ['.stl', loadModel],
  ['.fbx', loadModel],
  ['.glb', loadModel],
  ['.gltf', loadModel],
]);

const imageLoaders = new Map<string, (fileInfo: FileInfo) => Promise<string>>([
  ['.png', loadImage],
  ['.jpg', loadImage],
  ['.gif', loadImage],
  ['.apng', loadImage],
  ['.ico', loadImage],
  ['.svg', loadImage],
]);

const audioLoaders = new Map<
  string,
  (fileInfo: FileInfo) => Promise<{ url: string; duration?: number }>
>([
  ['.wav', loadAudio],
  ['.ogg', loadAudio],
  ['.mp3', loadAudio],
  ['.flac', loadAudio],
]);

export const ImportMedia = (fileInfo: FileInfo | null | undefined) => {
  const importedMesh = useQuery<string>({
    enabled: !!fileInfo && modelLoaders.has(fileInfo.fileExt),
    refetchOnWindowFocus: false,
    queryKey: ['imported-mesh', fileInfo?.path],
    queryFn: () => modelLoaders.get(fileInfo!.fileExt)!(fileInfo!),
  });

  const importedImage = useQuery({
    enabled: !!fileInfo && imageLoaders.has(fileInfo.fileExt),
    queryKey: ['imported-image', fileInfo?.path],
    refetchOnWindowFocus: false,
    queryFn: () => imageLoaders.get(fileInfo!.fileExt)!(fileInfo!),
  });

  const importedAudio = useQuery({
    enabled: !!fileInfo && audioLoaders.has(fileInfo.fileExt),
    queryFn: () => audioLoaders.get(fileInfo!.fileExt)?.(fileInfo!),
    queryKey: ['imported-audio', fileInfo?.path],
    refetchOnWindowFocus: false,
  });

  return { importedMesh, importedAudio, importedImage };
};

export default function RegisterFileLoadFile(): {
  fileInfo: FileInfo | null;
  setFileInfo: React.Dispatch<React.SetStateAction<FileInfo | null>>;
} {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);

  return {
    fileInfo,
    setFileInfo,
  };
}
