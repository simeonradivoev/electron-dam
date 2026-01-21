import { isDarkTheme } from '@blueprintjs/core/lib/esm/common/utils';
import { useQuery } from '@tanstack/react-query';
import { dirname, basename, isAbsolute } from 'pathe';
import React, { useEffect } from 'react';
import { ShowAppToaster } from 'renderer/scripts/toaster';
import { SSAAPlugin, HemisphereLight, STLLoadPlugin, ThreeViewer } from 'threepipe/lib/index';

type Props = {
  importedMesh: string | undefined;
};

function PreviewPanel3D({ importedMesh }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewerRef = React.useRef<ThreeViewer>();
  const darkThemeColor = isDarkTheme(canvasRef.current) ? '#1c2127' : '#f6f7f9';
  useEffect(() => {
    if (!viewerRef.current) {
      const viewer = new ThreeViewer({
        canvas: canvasRef.current ?? undefined,
        plugins: [STLLoadPlugin, SSAAPlugin],
        backgroundColor: darkThemeColor,
      });
      viewer.assetManager.importer.addEventListener('importFile', (e) => {
        if (e.state === 'error' && e.error) {
          ShowAppToaster({
            message: e.error.message,
            intent: 'danger',
            icon: 'model',
          });
        }
      });
      viewerRef.current = viewer;
    }
  }, [darkThemeColor]);

  useEffect(() => {
    const viewer = viewerRef.current;
    return () => {
      if (viewer) {
        viewer.dispose();
        viewerRef.current = undefined;
      }
    };
  }, [viewerRef]);

  const modelData = useQuery({
    enabled: !!importedMesh && !!viewerRef.current,
    queryKey: ['model', importedMesh ?? ''],
    queryFn: async () => {
      viewerRef.current?.assetManager.importer.loadingManager.setURLModifier((url) => {
        if (isAbsolute(url) || url.startsWith('http')) {
          return url;
        }
        return `app://${dirname(importedMesh!)}/${url}`;
      });
      await viewerRef.current!.load(basename(importedMesh!), {
        autoCenter: true,
        autoScale: true,
        autoSetEnvironment: true,
        clearSceneObjects: true,
      });

      await viewerRef.current!.setEnvironmentMap(
        'https://samples.threepipe.org/minimal/venice_sunset_1k.hdr',
      );
      viewerRef.current?.scene.addObject(new HemisphereLight(0xffffff, 0x444444, 10));

      return true;
    },
  });

  return <canvas color={darkThemeColor} id="three-canvas" ref={canvasRef} />;
}

export default PreviewPanel3D;
