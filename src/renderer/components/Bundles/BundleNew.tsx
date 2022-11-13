import {
  BreadcrumbProps,
  Button,
  ControlGroup,
  FormGroup,
  InputGroup,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading,
  Position,
  TagInput,
  TextArea,
  Toaster,
} from '@blueprintjs/core';
import { Breadcrumbs2 } from '@blueprintjs/popover2';

import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isValidHttpUrl } from 'renderer/scripts/utils';
import { generateUUID } from 'three/src/math/MathUtils';

type Props = {};

const BundleNew = (props: Props) => {
  const toasterRef = useRef<Toaster>(null);
  const [isImportingMetadata, setIsImportingMetadata] =
    useState<boolean>(false);
  const [isCreatingBundle, setIsCreatingBundle] = useState<boolean>(false);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [bundleId] = useState<string>(generateUUID());
  const bundleUrlValid = useMemo(() => isValidHttpUrl(sourceUrl), [sourceUrl]);
  const [bundleName, setBundleName] = useState<string>('');
  const [bundlePreview, setBundlePreview] = useState<string>('');
  const [bundleDescription, setBundleDescription] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate('/bundles');
  };

  const handleSubmit = async () => {
    const virutalBundle: VirtualBundle = {
      previewUrl: bundlePreview,
      description: bundleDescription,
      name: bundleName,
      sourceUrl,
      id: bundleId,
    };
    setIsCreatingBundle(true);
    await window.api.createVirtualBundle(virutalBundle);
    await window.api.updateTags(bundleId, tags);
    navigate('/bundles');
    setIsCreatingBundle(false);
  };

  const handleImport = async () => {
    setIsImportingMetadata(true);
    try {
      const metadata = await window.api.importBundleMetadata(sourceUrl);
      if (metadata.title) {
        setBundleName(metadata.title);
      }
      if (metadata.description) {
        setBundleDescription(metadata.description);
      }
      if (metadata.preview) {
        setBundlePreview(metadata.preview);
      }
      if (metadata.keywords) {
        setTags(metadata.keywords);
      }
    } catch (error) {
      toasterRef.current?.show({ message: `${error}`, intent: 'danger' });
    } finally {
      setIsImportingMetadata(false);
    }
  };

  const breadcrumbs: BreadcrumbProps[] = [
    { onClick: handleCancel, icon: 'projects', text: 'Bundles' },
    {
      icon: 'add',
      text: 'New Virtual Bundle',
    },
  ];

  return (
    <div className="new-bundle-layout">
      <Navbar>
        <NavbarGroup>
          <NavbarHeading>
            <Breadcrumbs2 className="breadcrumbs" items={breadcrumbs} />
          </NavbarHeading>
        </NavbarGroup>
      </Navbar>
      <div className="new-bundle y-scroll">
        <form onSubmit={handleSubmit}>
          <FormGroup label="Link" labelFor="sourceUrl">
            <ControlGroup>
              <InputGroup
                type="url"
                name="link"
                fill
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
              <Button
                disabled={
                  !sourceUrl ||
                  !bundleUrlValid ||
                  isImportingMetadata ||
                  isCreatingBundle
                }
                onClick={handleImport}
                icon="import"
              >
                Import
              </Button>
            </ControlGroup>
          </FormGroup>
          <FormGroup label="Id">
            <InputGroup name="id" disabled fill value={bundleId} />
          </FormGroup>
          <FormGroup label="Name">
            <InputGroup
              name="name"
              fill
              value={bundleName}
              onChange={(e) => setBundleName(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Preview">
            <div id="preview">
              <img alt="preview" src={bundlePreview} />
            </div>
            <InputGroup
              name="preview"
              fill
              value={bundlePreview}
              onChange={(e) => setBundlePreview(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Description">
            <TextArea
              name="description"
              fill
              value={bundleDescription}
              onChange={(e) => setBundleDescription(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Tags">
            <TagInput values={tags} />
          </FormGroup>
          <Button
            disabled={
              isImportingMetadata || isCreatingBundle || !bundleUrlValid
            }
            icon="floppy-disk"
            intent="success"
            type="submit"
          >
            Create
          </Button>
          <Button
            disabled={isImportingMetadata || isCreatingBundle}
            onClick={handleCancel}
            icon="cross"
          >
            Cancel
          </Button>
          <Toaster position={Position.BOTTOM_RIGHT} ref={toasterRef} />
        </form>
      </div>
    </div>
  );
};

export default BundleNew;
