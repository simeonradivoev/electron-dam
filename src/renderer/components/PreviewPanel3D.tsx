import { Spinner } from '@blueprintjs/core';
import {
  Bounds,
  GizmoHelper,
  GizmoViewport,
  Html,
  OrbitControls,
  Shadow,
  useBounds,
} from '@react-three/drei';
import { UseQueryResult } from '@tanstack/react-query';
import { Suspense, useEffect, useRef } from 'react';

type Props = {
  importedMesh: UseQueryResult<any | null, unknown>;
};

const PrimitiveComponent = ({ importedMesh }: Props) => {
  const bounds = useBounds();
  const primitiveRef = useRef<any>();
  useEffect(() => {
    // Calculate scene bounds
    bounds.refresh(primitiveRef.current).clip().fit();
    // Or, focus a specific object or box3
    // bounds.refresh(ref.current).clip().fit()
    // bounds.refresh(new THREE.Box3()).clip().fit()
  }, [bounds, importedMesh]);

  return (
    <primitive
      ref={primitiveRef}
      visible={!importedMesh.isPreviousData}
      object={importedMesh.data}
    />
  );
};

const PreviewPanel3D = ({ importedMesh }: Props) => {
  return (
    <>
      <spotLight
        position={[-100, -100, -100]}
        intensity={0.2}
        angle={0.3}
        penumbra={1}
      />
      <hemisphereLight
        color="white"
        groundColor="gray"
        position={[-7, 25, 13]}
        intensity={1}
      />
      <GizmoHelper
        alignment="bottom-right" // widget alignment within scene
        margin={[80, 80]} // widget margins (X, Y)
      >
        <GizmoViewport
          axisColors={['red', 'green', 'blue']}
          labelColor="black"
        />
      </GizmoHelper>
      <Suspense fallback={null}>
        <Bounds observe damping={6} margin={2}>
          <PrimitiveComponent importedMesh={importedMesh} />
        </Bounds>
      </Suspense>
      <gridHelper args={[10, 10]} />
      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 1.75}
      />
      {importedMesh.isPreviousData && (
        <Html center>
          <Spinner size={64} />
        </Html>
      )}
    </>
  );
};

export default PreviewPanel3D;
