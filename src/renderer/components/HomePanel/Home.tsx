/* eslint-disable prettier/prettier */
// src/renderer/components/HomePanel/Home.tsx
import { useState, useEffect, useContext } from 'react';
import { Card, Icon, NonIdealState, Spinner, Tag } from '@blueprintjs/core';
import { useQueryClient } from '@tanstack/react-query';
import { AppContext } from 'renderer/AppContext';
import { useNavigate } from 'react-router-dom';
import { forEachNode } from 'renderer/scripts/file-tree';
import humanFileSize from 'renderer/scripts/utils';
import Bundle from '../Bundles/Bundle';

interface Props {
  // Add any props you need here
}

const Home = (props: Props) => {
  const [randomBundles, setRandomBundles] = useState<BundleInfo[] | null>(null);
  const [recentBundles, setRecentBundles] = useState<BundleInfo[] | null>([]);
  const [fileCount, setFileCount] = useState(-1);
  const [sizeOfAllFiles, setSizeOfAllFiles] = useState(-1);
  const [stats, setStats] = useState<HomePageStats>();
  const { setFileInfo, files, tags } = useContext(AppContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRandomBundle = async () => {
      const bundle = await window.api.getHomeBundles();
      setRandomBundles(bundle?.random ?? []);
      setRecentBundles(bundle?.recent ?? []);
      setStats(bundle?.stats);
    };
    fetchRandomBundle();
  }, [queryClient]);

  useEffect(() => {
    if (files.data === undefined) {
      setFileCount(-1);
      setSizeOfAllFiles(-1);
      return;
    }

    let size = 0;
    let count = 0;

    forEachNode(files.data, (node) => {
      if (!node.nodeData?.isDirectory) {
        count += 1;
        size += node.nodeData?.size ?? 0;
      }
    });

    setFileCount(count);
    setSizeOfAllFiles(size);
  }, [files.data]);

  if (!randomBundles) {
    return (
      <NonIdealState
        icon={<Spinner />}
        title="Loading..."
        description="Please wait while we load a bundles..."
      />
    );
  }

  const elevation = 0;
  const handleSelect = (id: string | number) => {
    navigate({
      pathname: `/bundles/${id}/info`,
    });
  };

  return (
    <div className="home">
      <div className="stats-container">
        <Card elevation={elevation}>
          <p>
            {' '}
            <Icon icon="projects" /> Total Bundles
          </p>
          <h1>{stats?.bundleCount}</h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            {' '}
            <Icon icon="archive" /> Bundles On Disk
          </p>
          <h1>
            {(stats?.bundleCount ?? 0) - (stats?.virtualBundleCount ?? 0)}
          </h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            {' '}
            <Icon icon="cloud" /> Virtual Bundles
          </p>
          <h1>{stats?.virtualBundleCount}</h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            <Icon icon="document" /> File Count
          </p>
          <h1>{fileCount < 0 ? <Spinner /> : fileCount}</h1>
        </Card>
        <Card elevation={elevation}>
          <p>
            <Icon icon="folder-open" /> All Assets Size
          </p>
          <h1>
            {sizeOfAllFiles < 0 ? <Spinner /> : humanFileSize(sizeOfAllFiles)}
          </h1>
        </Card>
      </div>
      <div className="tags-container">
        <Card elevation={elevation}>
          <p>
            <Icon icon="tag" /> Tags
          </p>
          <div className="quick-tags">
            {tags.isSuccess ? (
              tags.data.map((tag) => (
                <Tag
                  className="tag"
                  key={tag}
                  minimal
                  interactive={!files.isFetching}
                  title={tag}
                >
                  {tag}
                  <Tag className="amount" round>
                    {10}
                  </Tag>
                </Tag>
              ))
            ) : (
              <></>
            )}
          </div>
        </Card>
      </div>
      <div className="bundles-container">
        <Card elevation={elevation} className="bundles-section">
          <p>
            <Icon icon="random" /> Random Bundle
          </p>
          <div className="bundles-grid">
            <div className="grid y-scroll">
              {randomBundles?.map((randomBundle) => (
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
        <Card elevation={elevation} className="bundles-section">
          <p>
            <Icon icon="time" /> Recent Bundles
          </p>
          <div className="bundles-grid">
            <div className="grid y-scroll">
              {recentBundles?.map((bundle) => (
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
};

export default Home;
