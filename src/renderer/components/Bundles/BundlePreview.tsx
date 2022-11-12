import { Button, Classes, Divider } from '@blueprintjs/core';

type Props = {
  fileInfo: FileInfo | null;
  className?: string;
};

const BundlePreview = ({ fileInfo, className }: Props) => {
  return (
    <div className={`preview-bundle ${className}`}>
      {fileInfo?.previewPath ? (
        <div
          className="preview-image-container"
          style={{
            backgroundImage: `url(file://${encodeURI(
              fileInfo.previewPath.replaceAll('\\', '/')
            )})`,
          }}
        >
          <img alt={`${fileInfo.name} Preview`} src={fileInfo.previewPath} />
        </div>
      ) : (
        <div className="preview-image-container" />
      )}
      <Divider />
      <div className="bundle-content">
        <div className="title">
          <h1 className={fileInfo ? '' : Classes.SKELETON}>
            {fileInfo?.name ?? 'Bundle Loading Placeholder Text'}
          </h1>
          {fileInfo?.bundle?.bundle.sourceUrl ? (
            <Button
              onClick={() =>
                window.open(fileInfo.bundle?.bundle.sourceUrl, '_blank')
              }
              intent="primary"
              small
              icon="link"
            />
          ) : (
            <></>
          )}
        </div>
        <p className="css-fix">{fileInfo?.bundle?.bundle.description}</p>
      </div>
    </div>
  );
};

export default BundlePreview;
