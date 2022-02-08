<script lang="ts">
  import { theme } from './store'
  import { onMount } from 'svelte'

  onMount(() => {
    if ($theme === 'dark') {
      document.querySelector('html').classList.add('dark')
    }
  })
</script>

<main>
  <slot />
</main>