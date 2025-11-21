import { Button, Classes, Divider, Icon } from '@blueprintjs/core';
import FolderFileGrid from '../FileInfoPanel/FolderFileGrid';

type Props = {
  bundle: BundleInfo | null;
  className?: string;
  showFiles?: boolean;
  onSelect: (id: string | number) => void;
};

/**
 * This will be used in the explorer tab
 */
const BundlePreview = ({
  bundle,
  className,
  onSelect: select,
  showFiles = false,
}: Props) => {
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
          {bundle?.isVirtual ? (
            <></>
          ) : (
            <Button
              onClick={() => select(bundle!.id)}
              intent="primary"
              small
              icon="folder-open"
              title="View In Explorer"
            />
          )}
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
        {!bundle?.isVirtual && showFiles && (
          <>
            <Divider />
            <FolderFileGrid path={bundle?.id ?? ''} />
          </>
        )}
      </div>
    </div>
  );
};

export default BundlePreview;

BundlePreview.defaultProps = {
  showFiles: false,
};
