process.env.BABEL_ENV = "production";
process.env.NODE_ENV = "production";

process.on("unhandledRejection", (err) => {
  throw err;
});

const webpackConfigPath = require.resolve("react-scripts/config/webpack.config");
const originalWebpackConfigFactory = require(webpackConfigPath);

function disableTerserParallel(config) {
  const minimizers = config?.optimization?.minimizer;

  if (!Array.isArray(minimizers)) {
    return config;
  }

  for (const minimizer of minimizers) {
    if (!minimizer || !minimizer.constructor) {
      continue;
    }

    if (minimizer.constructor.name === "TerserPlugin") {
      minimizer.options = {
        ...minimizer.options,
        parallel: false,
      };
    }
  }

  return config;
}

require.cache[webpackConfigPath].exports = (webpackEnv) => {
  const config = originalWebpackConfigFactory(webpackEnv);
  return disableTerserParallel(config);
};

require("react-scripts/scripts/build");
