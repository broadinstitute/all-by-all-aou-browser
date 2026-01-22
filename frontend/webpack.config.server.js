const path = require('path')
const pkg = require('./package.json')

const CopyPlugin = require("copy-webpack-plugin");

const projectDirectory = path.resolve(__dirname)

const isDev = process.env.NODE_ENV === 'development'

const config = {
  devtool: 'source-map',
  entry: {
    server: [path.resolve(__dirname, './src/server/server.ts')],
  },
  externals(context, request, callback) {
    // Do not bundle dependencies
    return context.includes(projectDirectory) && request in pkg.dependencies
      ? callback(null, `commonjs ${request}`)
      : callback()
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'esbuild-loader',
        exclude: /node_modules/,
        options: {
          loader: 'tsx',
          target: 'es2015'
        }
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@karaogram/kgui': path.resolve(__dirname, 'ui/kgui/src'),
      '@karaogram/types': path.resolve(__dirname, 'ui/types/src'),
      '@gnomad/classification-selector': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/classification-selector/src'),
      '@gnomad/identifiers': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/identifiers/src'),
      '@gnomad/manhattan-plot': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/manhattan-plot/src'),
      '@gnomad/markdown-loader': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/markdown-loader/src'),
      '@gnomad/qq-plot': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/qq-plot/src'),
      '@gnomad/region-viewer': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/region-viewer/src'),
      '@gnomad/track-transcripts': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/track-transcripts/src'),
      '@gnomad/track-variants': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/track-variants/src'),
      '@gnomad/ui': path.resolve(__dirname, 'gnomad-browser-toolkit/packages/ui/src'),
    },
  },
  mode: isDev ? 'development' : 'production',
  node: false, // Do not replace Node builtins
  output: {
    path: path.resolve(__dirname, './dist'),
    publicPath: '/',
    filename: '[name].js',
  },
  target: 'node',
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./src/server/public", to: "public" },
      ],
    }),
  ],
}

module.exports = config
