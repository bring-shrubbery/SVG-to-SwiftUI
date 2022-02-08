module.exports = {
  ...require('@quassum/prettier-config'),
  plugins: ['prettier-plugin-svelte'],
  svelteSortOrder: 'options-scripts-markup-styles',
  svelteStrictMode: true,
  svelteBracketNewLine: true,
  svelteIndentScriptAndStyle: true,
};
