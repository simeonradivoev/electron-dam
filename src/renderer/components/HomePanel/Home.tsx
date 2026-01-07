/* eslint-disable prettier/prettier */
// src/renderer/components/HomePanel/Home.tsx
import { Card, Classes, Icon, NonIdealState, Spinner, Tag, Text } from '@blueprintjs/core';
import { Tooltip2 } from '@blueprintjs/popover2';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import { LoadGlobalTags } from 'renderer/scripts/file-tree';
import { humanFileSize, QueryKeys } from 'renderer/scripts/utils';
import Bundle from '../Bundles/Bundle';

interface Props {
  // Add any props you need here
}

function Home(props: Props) {
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => window.api.getHomeBundles() });
  const { setFileInfo, database, projectDirectory } = useApp();
  const { data: tagsData } = useQuery({
    enabled: !!database && !!projectDirectory,
    queryKey: [QueryKeys.tags, projectDirectory],
    queryFn: LoadGlobalTags,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const navigate = useNavigate();

  const elevation = 0;
  const handleSelect = useCallback(
    (id: string | number) => {
      navigate({
        pathname: `/bundles/${encodeURIComponent(id.toString() ?? '')}/info`,
      });
    },
    [navigate],
  );

  if (stats.isLoading) {
    return (
      <NonIdealState
        icon={<Spinner />}
        title="Loading..."
        description="Please wait while we load a bundles..."
      />
    );
  }

  return (
    <div className="home y-scroll wide">
      <div className="container">
        <div className=".fix" />
        <Card elevation={elevation}>
          <p>
            {' '}
            <Icon icon="projects" /> Total Bundles
          </p>
          <h1>{stats?.data?.stats.bundleCount}</h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            {' '}
            <Icon icon="archive" /> Bundles On Disk
          </p>
          <h1>
            {(stats?.data?.stats?.bundleCount ?? 0) - (stats?.data?.stats?.virtualBundleCount ?? 0)}
          </h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            {' '}
            <Icon icon="cloud" /> Virtual Bundles
          </p>
          <h1>{stats?.data?.stats?.virtualBundleCount}</h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            <Icon icon="document" /> File Count
          </p>
          <h1>{stats?.data?.stats.assetCount}</h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            <Icon icon="folder-open" /> All Assets Size
          </p>
          <h1>{humanFileSize(stats?.data?.stats.assetsSize ?? 0)}</h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            <Icon icon="help" /> Missing
          </p>
          <ul className={classNames(Classes.LIST, Classes.LIST_UNSTYLED, Classes.TEXT_MUTED)}>
            <li>
              <Tooltip2 content="How many files have no description or that can be used to derive embeddings.">
                <Text>
                  Metadata: {stats?.data?.stats.missingMetadataCount} (
                  {(
                    1 -
                    (stats?.data?.stats.missingMetadataCount ?? 0) /
                      (stats.data?.stats.assetCount ?? 1)
                  ).toLocaleString(undefined, { style: 'percent' })}
                  )
                </Text>
              </Tooltip2>
            </li>
            <li>
              <Tooltip2 content="How many assets have metadata such as a description but have no generated embeddings for it">
                <Text>Embeddings: {stats?.data?.stats.missingEmbeddingsCount}</Text>
              </Tooltip2>
            </li>
            <li>
              <Tooltip2 content="How many files are not in a bundle">
                <Text>
                  Loose: {stats?.data?.stats.missingBundlesCount} (
                  {(
                    1 -
                    (stats?.data?.stats.missingBundlesCount ?? 0) /
                      (stats.data?.stats.assetCount ?? 1)
                  ).toLocaleString(undefined, { style: 'percent' })}
                  )
                </Text>
              </Tooltip2>
            </li>
          </ul>
        </Card>
        <Card elevation={elevation} className="tags-container">
          <p>
            <Icon icon="tag" /> Tags ({tagsData?.count})
          </p>
          <div className="quick-tags y-scroll">
            {tagsData ? (
              tagsData.tags.map((tag) => (
                <Tag
                  className="tag"
                  key={tag.tag}
                  minimal
                  interactive={!stats.isFetching}
                  title={tag.tag}
                >
                  {tag.tag}
                  <Tag className="amount" round>
                    {tag.count}
                  </Tag>
                </Tag>
              ))
            ) : (
              <Spinner />
            )}
          </div>
        </Card>
        <Card elevation={elevation} className="bundles-container">
          <p>
            <Icon icon="random" /> Random Bundles Of The Day
          </p>
          <div className="bundles-grid">
            <div className="grid y-scroll">
              {stats?.data?.random?.map((randomBundle) => (
                <Bundle
                  setFileInfo={setFileInfo}
                  onSelect={handleSelect}
                  bundle={randomBundle}
                  key={randomBundle.id}
                />
              ))}
            </div>
          </div>
        </Card>
        <Card elevation={elevation} className="bundles-container">
          <p>
            <Icon icon="time" /> Recent Bundles
          </p>
          <div className="bundles-grid">
            <div className="grid y-scroll">
              {stats?.data?.recent?.map((bundle) => (
                <Bundle
                  setFileInfo={setFileInfo}
                  onSelect={handleSelect}
                  bundle={bundle}
                  key={bundle.id}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Home;
