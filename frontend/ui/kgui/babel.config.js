let presets = []
let plugins = []
if (process.env.CYPRESS_INTERNAL_ENV !== undefined) {
  presets = []
} else {
  presets = [...presets, '@babel/preset-typescript', '@babel/preset-react']
  plugins = ['@babel/plugin-proposal-class-properties', 'styled-components', 'inline-react-svg']
  if (process.env.IS_ROLLUP === 'true') {
    presets = [
      ...presets,
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current',
          },
          modules: false,
        },
      ],
    ]
  } else if (process.env.NODE_ENV === 'test') {
    presets = [
      ...presets,
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current',
          },
        },
      ],
    ]
  }
}

module.exports = {
  presets,
  plugins,
}
