const preprocess = require('svelte-preprocess')
const ssr = require('@sveltejs/adapter-static')

/** @type {import('@sveltejs/kit').Config} */
module.exports = {
  preprocess: [
    preprocess()
  ],

  kit: {
    adapter: ssr(),
    target: '#svelte'
  }
}