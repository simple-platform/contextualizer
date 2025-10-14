import antfu from '@antfu/eslint-config'
import perfectionist from 'eslint-plugin-perfectionist'

export default antfu({
  formatters: true,

  ignores: [
    'node_modules/',
  ],

  javascript: true,
  plugins: { perfectionist },

  rules: {
    ...perfectionist.configs['recommended-natural'].rules,
    'import/order': ['off'],
  },

  stylistic: true,
  typescript: true,
})
