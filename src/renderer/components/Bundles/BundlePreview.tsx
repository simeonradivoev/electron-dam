import { Button, Classes, Divider, Icon } from '@blueprintjs/core';

type Props = {
  bundle: BundleInfo | null;
  className?: string;
};

const BundlePreview = ({ bundle, className }: Props) => {
  return (
    <div className={`preview-bundle ${className}`}>
      {bundle?.previewUrl ? (
        <div
          className="preview-image-container"
          style={{
            backgroundImage: `url(file://${encodeURI(
              bundle.previewUrl.replaceAll('\\', '/')
            )})`,
          }}
        >
          <img alt={`${bundle.name} Preview`} src={bundle.previewUrl} />
        </div>
      ) : (
        <div className="preview-image-container" />
      )}
      <Divider />
      <div className="bundle-content">
        <div className="title">
          <h1 className={bundle ? '' : Classes.SKELETON}>
            {bundle?.name ?? 'Bundle Loading Placeholder Text'}
          </h1>

          {bundle?.bundle.sourceUrl ? (
            <Button
              onClick={() => window.open(bundle.bundle.sourceUrl, '_blank')}
              title={bundle.bundle.sourceUrl}
              intent="primary"
              small
              icon="link"
            />
          ) : (
            <></>
          )}
        </div>
        <p className="css-fix">{bundle?.bundle.description}</p>
      </div>
    </div>
  );
};

export default BundlePreview;
