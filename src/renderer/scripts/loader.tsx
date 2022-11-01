/* eslint-disable no-restricted-syntax */
import { useState } from 'react';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as three from 'three';
import { useQuery, UseQueryResult } from '@tanstack/react-query';

function loadAssimpModel(
  info: FileInfo,
  setImportedMesh: (mesh: any) => void
): boolean {
  if (!info.modelData) {
    return false;
  }

  const gltfLoader = new GLTFLoader();
  gltfLoader
    .parseAsync(info.modelData.buffer, info.directory)
    .then((value) => {
      setImportedMesh(<primitive object={value.scene} />);
      return true;
    })
    .catch((error) => {
      console.error(error);
      setImportedMesh(undefined);
      return false;
    });

  return true;
}

function loadObjModel(info: FileInfo, setImportedMesh: (mesh: any) => void) {
  if (loadAssimpModel(info, setImportedMesh)) {
    return;
  }

  const objLoader = new OBJLoader();

  if (info.hasMaterialLibrary) {
    const mtlLoader = new MTLLoader();
    mtlLoader.load(
      info?.path.replace('.obj', '.mtl'),
      (loadedMats: any) => {
        objLoader.setMaterials(loadedMats);
        objLoader.load(
          info.path,
          (loadedObj: any) => {
            setImportedMesh(<primitive object={loadedObj} />);
          },
          (progress: any) => {},
          (error: any) => {
            console.error(error);
            setImportedMesh(undefined);
          }
        );
      },
      (progress: any) => {},
      (error: any) => {
        console.error(error);
        setImportedMesh(undefined);
      }
    );
  } else {
    objLoader.load(
      info.path,
      (loadedObj: any) => {
        setImportedMesh(loadedObj);
      },
      (progress: any) => {},
      (error: any) => {
        console.error(error);
        setImportedMesh(undefined);
      }
    );
  }
}

function loadStlModel(info: FileInfo, setImportedMesh: (mesh: any) => void) {
  if (loadAssimpModel(info, setImportedMesh)) {
    return;
  }

  const stlLoader = new STLLoader();
  stlLoader.load(
    info?.path,
    (obj: any) => {
      setImportedMesh(
        <mesh>
          <bufferGeometry {...obj} />
          <meshStandardMaterial />
        </mesh>
      );
    },
    (progress: any) => {},
    (error: any) => {
      console.error(error);
      setImportedMesh(undefined);
    }
  );
}

function loadFbxModel(info: FileInfo, setImportedMesh: (mesh: any) => void) {
  if (loadAssimpModel(info, setImportedMesh)) {
    return;
  }

  const fbxLoader = new FBXLoader();
  fbxLoader.load(
    info?.path,
    (obj: any) => {
      setImportedMesh(obj);
    },
    (progress: any) => {},
    (error: any) => {
      console.error(error);
      setImportedMesh(undefined);
    }
  );
}

async function loadGltfModel(info: FileInfo): Promise<any | undefined> {
  const gltfLoader = new GLTFLoader().setPath(`${info.directory}/`);
  const gltf = await gltfLoader.loadAsync(info?.name);
  return gltf.scene;
}

async function loadModel(info: FileInfo): Promise<any | undefined> {
  const gltfLoader = new GLTFLoader();

  if (info.modelData) {
    const gltf = await gltfLoader.parseAsync(
      info.modelData.buffer,
      info.directory
    );
    return gltf.scene;
  }

  return Promise.reject();
}

function loadImage(info: FileInfo): Promise<string> {
  return Promise.resolve(info.path);
}

function loadAudio(info: FileInfo): Promise<string> {
  return Promise.resolve(info.path);
}

type ExtensionLoaderSetter = (fileInfo: FileInfo) => Promise<any>;

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

const audioLoaders = new Map<string, (fileInfo: FileInfo) => Promise<string>>([
  ['.wav', loadAudio],
  ['.ogg', loadAudio],
  ['.mp3', loadAudio],
  ['.flac', loadAudio],
]);

export default function RegisterFileLoadFile(): {
  fileInfo: FileInfo | null;
  importedMesh: UseQueryResult<any, unknown>;
  importedAudio: UseQueryResult<string | null, unknown>;
  importedImage: UseQueryResult<string | null, unknown>;
  setFileInfo: (fileInfo: FileInfo | null) => void;
} {
  const [fileInfo, setFileInfoState] = useState<FileInfo | null>(null);
  const importedMesh = useQuery<any | null>(
    ['imported-mesh', fileInfo?.path],
    async () => {
      const loader = modelLoaders.get(fileInfo!.fileExt);
      if (loader) {
        return loader(fileInfo!);
      }
      return Promise.resolve(null);
    },
    { enabled: !!fileInfo, keepPreviousData: true }
  );

  const importedImage = useQuery<string | null>(
    ['imported-image', fileInfo],
    async () => {
      const loader = imageLoaders.get(fileInfo!.fileExt);
      if (loader) {
        return loader(fileInfo!);
      }
      return null;
    },
    { enabled: !!fileInfo }
  );

  const importedAudio = useQuery<string | null>(
    ['imported-audio', fileInfo],
    async () => {
      const loader = audioLoaders.get(fileInfo!.fileExt);
      if (loader) {
        return loader(fileInfo!);
      }
      return null;
    },
    { enabled: !!fileInfo }
  );

  const setFileInfo = (info: FileInfo | null) => {
    setFileInfoState(info);
  };

  return {
    fileInfo,
    importedMesh,
    importedAudio,
    importedImage,
    setFileInfo,
  };
}
