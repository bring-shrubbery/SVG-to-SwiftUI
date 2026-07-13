export default {
  testEnvironment: "node",
  rootDir: "src",
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!.*(?:css-select|css-what|boolbase|domhandler|domutils|domelementtype|nth-check|dom-serializer|entities)(?:@|/))",
  ],
};
