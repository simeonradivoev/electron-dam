# Contributing to Electron DAM

First off, thank you for considering contributing to Electron DAM! It's people like you that make this project better.

## Code of Conduct

### Our Pledge

We are committed to providing a friendly, safe, and welcoming environment for all contributors, regardless of experience level, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, nationality, or other similar characteristics.

### Our Standards

Examples of behavior that contributes to a positive environment:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the project
- Showing empathy towards other community members

Examples of unacceptable behavior:

- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

## Development Process

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/electron-dam.git`
3. Install dependencies: `npm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`

### Making Changes

1. Make your changes in your feature branch
2. Test your changes thoroughly
3. Ensure your code follows the existing style
4. Update documentation as needed

### Commit Messages - Conventional Commits

**This project uses [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.**

#### Commit Message Format

Each commit message must follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

#### Scope

The scope should be the name of the affected component (e.g., `bundles`, `explorer`, `audio-player`, `ui`, etc.).

#### Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No period (.) at the end

#### Body

The body should include the motivation for the change and contrast this with previous behavior.

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Include motivation for the change
- Contrast with previous behavior

#### Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference issues that this commit closes.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

#### Examples

**Feature with scope:**
```
feat(bundles): add drag-and-drop move functionality

Implement native HTML5 drag-and-drop for moving bundles between folders
in the explorer tree view. Includes auto-scroll near edges and visual feedback.

Closes #123
```

**Bug fix:**
```
fix(audio-player): prevent crash when playing invalid file

Add validation to check file format before attempting to play.
Show user-friendly error message for unsupported formats.
```

**Breaking change:**
```
feat(api): change convertBundleToLocal error handling

Update convertBundleToLocal to throw errors instead of returning
false, allowing better error propagation to the UI layer.

BREAKING CHANGE: convertBundleToLocal now throws errors instead of returning false.
Callers must handle errors with try/catch instead of checking boolean return value.
```

**Simple change:**
```
docs: update README with installation instructions
```

### Pull Request Process

1. Ensure your commits follow the Conventional Commits format above
2. Update the CHANGELOG.md with details of changes (if applicable)
3. Ensure all tests pass
4. Update documentation for any new features
5. Create a Pull Request with a clear title and description
6. Link any related issues in the PR description
7. Wait for review and address any feedback

### PR Title Format

Pull Request titles should also follow Conventional Commits format:

```
feat(scope): add new feature
fix(scope): resolve bug
```

## Development Guidelines

### Code Style

- Follow existing code style and conventions
- Use TypeScript for type safety
- Write meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small

### Testing

- Test your changes thoroughly before submitting
- Add tests for new features
- Ensure existing tests still pass

### Documentation

- Update README.md for user-facing changes
- Update code comments for API changes
- Add JSDoc comments for new functions
- Keep CHANGELOG.md updated

## Questions?

If you have questions about contributing, feel free to:

- Open an issue for discussion
- Review existing issues and pull requests
- Check the documentation

Thank you for your contributions! 🎉
