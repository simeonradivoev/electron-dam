import { AnchorButton, Classes, Divider, H1, H2, HTMLTable } from '@blueprintjs/core';
import classNames from 'classnames';
import pkgMain from '../../../../package.json';
import pkgApp from '../../../../release/app/package.json';

export default function About() {
  const pkg = { ...pkgApp, ...pkgMain };

  return (
    <div
      style={{
        flexGrow: '1',
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <H1>{pkg.name}</H1>
        {pkg.description && <p className={classNames(Classes.TEXT_MUTED)}>{pkg.description}</p>}
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <AnchorButton
            variant="minimal"
            intent="primary"
            text={`Version ${pkg.version}`}
            disabled
          />
          <AnchorButton
            variant="minimal"
            intent="success"
            text="Homepage"
            icon="home"
            href={pkg.homepage}
            target="_blank"
          />
          <AnchorButton
            variant="minimal"
            intent="warning"
            text="Repository"
            icon="git-repo"
            href={pkg.repository.url.replace(/^git\+/, '')}
            target="_blank"
          />
          <AnchorButton
            variant="minimal"
            intent="danger"
            icon="bug"
            text="Bugs"
            href={pkg.bugs.url}
            target="_blank"
          />
        </div>
      </header>

      <Divider />
      <section style={{ marginTop: '2rem' }}>
        <H2>Project Info</H2>
        <HTMLTable striped bordered style={{ width: '100%', marginTop: '1rem' }}>
          <tbody>
            <tr>
              <td>
                <strong>Author</strong>
              </td>
              <td>{typeof pkg.author === 'string' ? pkg.author : pkg.author.name}</td>
            </tr>
            <tr>
              <td>
                <strong>License</strong>
              </td>
              <td>{pkg.license}</td>
            </tr>
            <tr>
              <td>
                <strong>Keywords</strong>
              </td>
              <td>{pkg.keywords.join(', ')}</td>
            </tr>
          </tbody>
        </HTMLTable>
      </section>

      {/* Dependencies */}
      {pkg.dependencies && (
        <section style={{ marginTop: '2rem' }}>
          <H2>Dependencies</H2>
          <HTMLTable striped bordered style={{ width: '100%', marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Package</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pkg.dependencies).map(([name, version]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{version}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </section>
      )}
    </div>
  );
}
