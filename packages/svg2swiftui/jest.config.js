export default {
  testEnvironment: "node",
  rootDir: "src",
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
};
