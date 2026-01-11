/* eslint-disable react/no-unknown-property */
/* eslint-disable no-restricted-syntax */
import { useQuery } from '@tanstack/react-query';
import log from 'electron-log/renderer';
import { normalize } from 'pathe';
import { useState } from 'react';
import { Group, Object3DEventMap } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

const gltfLoader = new GLTFLoader();
const stlLoader = new STLLoader();
const fbxLoader = new FBXLoader();

function loadAssimpModel(info: FileInfo, setImportedMesh: (mesh: unknown) => void): boolean {
  if (!info.modelData) {
    return false;
  }

  gltfLoader
    .parseAsync(info.modelData.buffer as ArrayBuffer, info.directory)
    .then((value) => {
      setImportedMesh(<primitive object={value.scene} />);
      return true;
    })
    .catch((error) => {
      setImportedMesh(error);
      return false;
    });

  return true;
}

function loadObjModel(info: FileInfo, setImportedMesh: (mesh: unknown) => void) {
  if (loadAssimpModel(info, setImportedMesh)) {
    return;
  }

  const objLoader = new OBJLoader();

  if (info.hasMaterialLibrary) {
    const mtlLoader = new MTLLoader();
    mtlLoader.load(
      info?.path.replace('.obj', '.mtl'),
      (loadedMats) => {
        objLoader.setMaterials(loadedMats);
        objLoader.load(
          info.path,
          (loadedObj) => {
            setImportedMesh(<primitive object={loadedObj} />);
          },
          (progress) => {},
          (error) => {
            log.error(error);
            setImportedMesh(undefined);
          },
        );
      },
      (progress) => {},
      (error) => {
        log.error(error);
        setImportedMesh(undefined);
      },
    );
  } else {
    objLoader.load(
      info.path,
      (loadedObj) => {
        setImportedMesh(loadedObj);
      },
      (progress) => {},
      (error) => {
        log.error(error);
        setImportedMesh(undefined);
      },
    );
  }
}

function loadStlModel(info: FileInfo, setImportedMesh: (mesh: unknown) => void) {
  if (loadAssimpModel(info, setImportedMesh)) {
    return;
  }

  stlLoader.load(
    info?.path,
    (obj) => {
      setImportedMesh(
        <mesh>
          <bufferGeometry {...obj} />
          <meshStandardMaterial />
        </mesh>,
      );
    },
    (progress) => {},
    (error) => {
      log.error(error);
      setImportedMesh(undefined);
    },
  );
}

function loadFbxModel(info: FileInfo): Promise<any | undefined> {
  /*if (loadAssimpModel(info, setImportedMesh)) {
    return;
  }*/

  const loadPromise = new Promise<Group<Object3DEventMap> | undefined>((resolve, reject) => {
    fbxLoader.load(
      info?.path,
      (obj) => {
        resolve(obj);
      },
      (progress) => {},
      (error) => {
        reject(error);
      },
    );
  });
  return loadPromise;
}

async function loadGltfModel(info: FileInfo): Promise<Group<Object3DEventMap> | undefined> {
  const loader = new GLTFLoader().setPath(`${info.directory}/`);
  const gltf = await loader.loadAsync(info?.name);
  return gltf.scene;
}

async function loadModel(info: FileInfo): Promise<Group<Object3DEventMap> | undefined> {
  if (info.modelData) {
    try {
      const gltf = await gltfLoader.parseAsync(
        info.modelData.buffer as ArrayBuffer,
        info.directory,
      );
      return gltf.scene;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return Promise.reject();
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

type ExtensionLoaderSetter = (fileInfo: FileInfo) => Promise<Group<Object3DEventMap> | undefined>;

const modelLoaders = new Map<string, ExtensionLoaderSetter>([
  ['.obj', loadModel],
  ['.stl', loadModel],
  ['.fbx', loadModel],
  ['.glb', loadModel],
  ['.gltf', loadGltfModel],
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
  const importedMesh = useQuery<Group<Object3DEventMap> | undefined>({
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
