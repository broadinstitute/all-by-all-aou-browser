const fs = require('fs')
const path = require('path')

const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
const simpleGit = require('simple-git')

const git = simpleGit()

const packageJson = JSON.parse(fs.readFileSync('package.json'))

const isDev = process.env.NODE_ENV === 'development'

const description =
  'The All by All browser maps known and novel associations between genotypes and ' +
  'phenotypes using data contributed by All of Us Research Program participants as of ' +
  'July 1, 2022. All by All encompasses about 3,400 phenotypes with gene-based and ' +
  'single-variant associations across nearly 250,000 whole genome sequences. In total, ' +
  'about 500 billion associations are available to explore. Results for individual ' +
  'common variants and group tests for rare variants are available, such as burden ' +
  'tests of predicted loss-of-function (pLoF) against each phenotype, in a public, ' +
  'cloud-based browser.'

const getWebpackConfig = async () => {
  const commitHash = await git.revparse(['--short', 'HEAD'])

  const dateObj = new Date()

  const time = dateObj.toISOString().replace(/[^0-9]/g, '').slice(0, 12)

  const version = `${packageJson.version}-${commitHash}-${time}`

  console.log('Browser version', version)

  const config = {
    devServer: {
      historyApiFallback: true,
      port: 8008,
    },
    devtool: 'inline-source-map',
    entry: './src/client/index.tsx',
    mode: isDev ? 'development' : 'production',
    module: {
      rules: [
        {
          test: /\.(gif|jpg|png)$/,
          use: {
            loader: 'file-loader',
            options: {
              outputPath: 'assets/images',
            },
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/fonts/[name][ext]',
          },
        },
        {
          test: /\.svg$/,
          use: ['@svgr/webpack'],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.md$/,
          use: {
            loader: path.resolve(__dirname, 'gnomad-browser-toolkit/packages/markdown-loader/src/markdownLoader.js'),
          },
        },
        {
          test: /\.tsx?$/,
          loader: 'esbuild-loader',
          options: {
            loader: 'tsx',
            target: 'es2015',
          },
        },
        {
          test: /\.jsx?$/,
          include: [
            path.resolve(__dirname, 'gnomad-browser-toolkit'),
          ],
          loader: 'esbuild-loader',
          options: {
            loader: 'jsx',
            target: 'es2015',
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
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
    output: {
      path: path.resolve(__dirname, './dist/public'),
      publicPath: '/',
      filename: isDev ? '[name].js' : '[name]-[contenthash].js',
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        API_URL: null,
        BRANCH_NAME: null,
        STATIC_URL: null,
        VERSION: version,
        AUTH0_ENABLE: process.env.AUTH0_ENABLE || 'false',
        AUTH0_DOMAIN: process.env.AUTH0_DOMAIN || '',
        AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || '',
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, './src/client/index.html'),
        favicon: './src/client/favicon.ico',
        meta: {
          description: {
            name: 'description',
            content: description,
          },
          'application-name': { name: 'application-name', content: 'All by All' },
          'apple-mobile-web-app-title': {
            name: 'apple-mobile-web-app-title',
            content: 'All by All',
          },
          'og:title': { property: 'og:title', content: 'All by All' },
          'og:site_name': { property: 'og:site_name', content: 'All by All' },
          'og:description': {
            property: 'og:description',
            content: description,
          },
          'og:type': { property: 'og:type', content: 'website' },
          'og:url': {
            property: 'og:url',
            content: 'https://allbyall.researchallofus.org',
          },
          'og:image': {
            property: 'og:image',
            content: './src/client/assets/AoU_Logo.svg',
          },
          'twitter:card': {
            property: 'twitter:card',
            content: 'summary_large_image',
          },
          'twitter:title': { property: 'twitter:title', content: 'All by All' },
          'twitter:description': {
            property: 'twitter:description',
            content: description,
          },
          'twitter:image': {
            property: 'twitter:image',
            content: './src/client/assets/AoU_Logo.svg',
          },
        },
      }),
    ],
  }

  if (isDev) {
    config.resolve = {
      ...config.resolve,
    }
  }

  return config
}

module.exports = getWebpackConfig

