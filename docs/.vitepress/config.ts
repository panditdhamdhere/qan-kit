import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'qan-kit',
  description: 'Deploy to QAN testnet without the usual yak shaving',
  themeConfig: {
    nav: [
      { text: 'Quickstart', link: '/' },
      { text: 'Guides', link: '/guide/slots' },
      { text: 'CLI', link: '/cli/reference' },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Deploy in 5 minutes', link: '/' },
          { text: 'Assumptions', link: '/ASSUMPTIONS' },
          { text: 'DX audit', link: '/DX-AUDIT' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Hardhat', link: '/guide/hardhat' },
          { text: 'Foundry', link: '/guide/foundry' },
          { text: 'CI', link: '/guide/ci' },
          { text: 'Why storage reads come back empty', link: '/guide/slots' },
          { text: 'Apple Silicon', link: '/guide/apple-silicon' },
          { text: 'XLINK', link: '/guide/xlink' },
        ],
      },
      {
        text: 'Reference',
        items: [{ text: 'CLI', link: '/cli/reference' }],
      },
    ],
  },
});
