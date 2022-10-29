import { Spinner } from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';
import PrismaZoom from 'react-prismazoom';

type Props = {
  image: UseQueryResult<string | null, unknown>;
};

const PreviewPanelImage = ({ image }: Props) => {
  return (
    <>
      <PrismaZoom>
        {image.data ? <img alt="" src={image.data} /> : <Spinner />}
      </PrismaZoom>
    </>
  );
};

export default PreviewPanelImage;
