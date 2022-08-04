function getAdapter() {
  return {
    name: "@astrojs/ssg"
  };
}
function createIntegration() {
  return {
    name: "@astrojs/ssg",
    hooks: {
      "astro:config:done": ({ setAdapter }) => {
        setAdapter(getAdapter());
      },
      "astro:build:start": ({ buildConfig }) => {
        buildConfig.staticMode = true;
      }
    }
  };
}
export {
  createIntegration as default,
  getAdapter
};
