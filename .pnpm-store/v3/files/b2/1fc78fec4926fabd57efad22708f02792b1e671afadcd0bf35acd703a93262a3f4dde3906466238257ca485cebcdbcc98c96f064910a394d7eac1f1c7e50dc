(self.Astro = self.Astro || {}).only = (getHydrateCallback) => {
  (async () => {
    let hydrate = await getHydrateCallback();
    await hydrate();
  })();
};
