module.exports = {
  extends: ['erb', 'plugin:react/jsx-runtime'],
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'import/no-extraneous-dependencies': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-import-module-exports': 'off',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-use-before-define': 'off',
  },
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: [],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-undef': 'off',
      },
    },
  ],
  settings: {
    'import/resolver': {
      // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        moduleDirectory: ['node_modules', 'src/'],
      },
      webpack: {
        config: require.resolve('./.erb/configs/webpack.config.eslint.ts'),
      },
      typescript: {},
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
  ignores: [
    // # Logs
    'logs',
    '*.log',
    // Runtime data
    'pids',
    '*.pid',
    '*.seed',
    // Coverage directory used by tools like istanbul
    'coverage',
    '.eslintcache',
    // Dependency directory
    'node_modules',
    // OSX
    '.DS_Store',
    'release/app/dist',
    'release/build',
    '.erb/dll',
    '.idea',
    'npm-debug.log.*',
    '*.css.d.ts',
    '*.sass.d.ts',
    '*.scss.d.ts',
    // eslint ignores hidden directories by default:
    // https://github.com/eslint/eslint/issues/8429
    '!.erb',
  ]
};
