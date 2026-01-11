import { Spinner } from '@blueprintjs/core';
import {
  Bounds,
  GizmoHelper,
  GizmoViewport,
  Html,
  OrbitControls,
  useBounds,
} from '@react-three/drei';
import { UseQueryResult } from '@tanstack/react-query';
import { Suspense, useEffect, useRef } from 'react';
import { Box3, Object3D, Object3DEventMap, Sphere, SphereGeometry, Vector3 } from 'three';

type Props = {
  importedMesh: UseQueryResult<unknown | null, unknown>;
};

function PrimitiveComponent({ importedMesh }: Props) {
  const bounds = useBounds();
  const primitiveRef = useRef<Object3D<Object3DEventMap> | Box3 | undefined>();
  useEffect(() => {
    // Calculate scene bounds
    bounds.refresh(primitiveRef.current).clip().fit();
    // Or, focus a specific object or box3
    // bounds.refresh(ref.current).clip().fit()
    // bounds.refresh(new THREE.Box3()).clip().fit()
  }, [bounds, importedMesh]);

  return (
    importedMesh.data && (
      <primitive
        ref={primitiveRef}
        // eslint-disable-next-line react/no-unknown-property
        visible={!importedMesh.isPlaceholderData}
        // eslint-disable-next-line react/no-unknown-property
        object={importedMesh.data}
      />
    )
  );
}

function PreviewPanel3D({ importedMesh }: Props) {
  return (
    <>
      <spotLight position={[-100, -100, -100]} intensity={0.2} angle={0.3} penumbra={1} />
      <hemisphereLight color="white" groundColor="gray" position={[-7, 25, 13]} intensity={1} />
      <GizmoHelper
        alignment="bottom-right" // widget alignment within scene
        margin={[80, 80]} // widget margins (X, Y)
      >
        <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="black" />
      </GizmoHelper>
      <Suspense fallback={null}>
        <Bounds observe margin={2}>
          <PrimitiveComponent importedMesh={importedMesh} />
        </Bounds>
      </Suspense>
      <gridHelper args={[10, 10]} />
      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
      {importedMesh.isFetching && (
        <Html center>
          <Spinner size={64} />
        </Html>
      )}
    </>
  );
}

export default PreviewPanel3D;
