import { Button, NonIdealState } from '@blueprintjs/core';

type Props = {
  setSelectedProjectDirectory: (directory: string | null) => void;
};

const ProjectSelection = ({ setSelectedProjectDirectory }: Props) => {
  const handleClick = async () => {
    setSelectedProjectDirectory(await window.api.selectProjectDirectory());
  };

  return (
    <NonIdealState
      icon="folder-open"
      title="Open Project"
      description="Open an existing project to start exploring your digital assets."
    >
      <Button
        intent="primary"
        icon="search"
        onClick={handleClick}
        text="Select Project"
      />
    </NonIdealState>
  );
};

export default ProjectSelection;
