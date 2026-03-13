const path = require("path");
const webpack = require("webpack");
const exec = require("child_process").exec;
const TerserPlugin = require("terser-webpack-plugin");

const fs = require("fs");

const copyBuildPlugin = {
  apply: (compiler) => {
    compiler.hooks.afterEmit.tap("AfterEmitPlugin", (compilation) => {
      const nodeVersion = process.env.npm_package_version;
      // Map source files to published filenames.
      // index.js in published/ should be the core build (no replay).
      // Users who need replay can explicitly load full.js.
      const variants = [
        { src: "core.js", dest: "core.js" },
        { src: "full.js", dest: "full.js" },
        { src: "core.js", dest: "index.js" },
      ];
      const dirs = [`published/${nodeVersion}`, "published/latest"];

      dirs.forEach((dir) => {
        fs.mkdirSync(dir, { recursive: true });
        variants.forEach(({ src, dest }) => {
          const srcPath = `./build/cjs/${src}`;
          const destPath = `${dir}/${dest}`;
          if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
          }
        });

        // Copy chunk files for lazy-loaded modules.
        const chunkFiles = fs
          .readdirSync("./build/cjs/")
          .filter((f) => f.endsWith(".chunk.js"));
        chunkFiles.forEach((file) => {
          fs.copyFileSync(`./build/cjs/${file}`, `${dir}/${file}`);
        });
      });

      console.log("DONE - copied bundles to published/");
    });
  },
};

// Common configuration
const commonConfig = (isDevelopment, plugins = []) => {
  var config = {
    mode: "production",
    entry: {
      index: "./src/index.js",
      core: "./src/index.core.js",
      full: "./src/index.full.js",
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            mangle: true,
            sourceMap: true,
            safari10: true,
            output: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
    },
    module: {
      rules: [
        {
          test: /\.m?js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: "babel-loader",
          },
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/,
          use: ["url-loader"],
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        SDK_VERSION: JSON.stringify(process.env.npm_package_version),
      }),
      ...plugins,
    ],
  };

  if (isDevelopment) {
    config.mode = "development";
    config.devServer = {
      compress: true,
      open: false,
      hot: true,
      host: "localhost",
      static: [
        {
          directory: path.join(__dirname, "demo"),
        },
        {
          directory: path.join(__dirname, "build"),
          publicPath: "/build",
        },
      ],
      port: 4444,
    };
  }

  return config;
};

// Configuration for ESM
const esmConfig = {
  ...commonConfig(false, []),
  output: {
    filename: "[name].mjs",
    chunkFilename: "[name].chunk.mjs",
    path: path.resolve(__dirname, "build/esm"),
    publicPath: "auto",
    library: {
      type: "module",
    },
    globalObject: "this",
    clean: true,
  },
  experiments: {
    outputModule: true,
  },
};

// Configuration for CJS
const cjsConfig = {
  ...commonConfig(false, [copyBuildPlugin]),
  output: {
    filename: "[name].js",
    chunkFilename: "[name].chunk.js",
    path: path.resolve(__dirname, "build/cjs"),
    publicPath: "auto",
    libraryTarget: "umd",
    library: "Yaplet",
    libraryExport: "default",
    globalObject: "this",
    clean: true,
  },
};

// Development configuration - outputs UMD to build/cjs/ without minification
const developmentConfig = {
  ...commonConfig(true, []),
  output: {
    filename: "[name].js",
    chunkFilename: "[name].chunk.js",
    path: path.resolve(__dirname, "build/cjs"),
    publicPath: "auto",
    libraryTarget: "umd",
    library: "Yaplet",
    libraryExport: "default",
    globalObject: "this",
  },
  optimization: {
    minimize: false,
  },
  devtool: "eval-source-map",
};

module.exports = (env) => {
  if (env && env.development) {
    return developmentConfig;
  } else {
    return [esmConfig, cjsConfig];
  }
};
