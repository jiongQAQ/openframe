import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const sharedAliases = [
  {
    find: /^@openframe\/shared\/object-storage-factory$/,
    replacement: path.resolve(__dirname, '../../packages/shared/utils/object_storage_factory.ts'),
  },
  {
    find: /^@openframe\/shared\/object-storage-config$/,
    replacement: path.resolve(__dirname, '../../packages/shared/utils/object_storage_config.ts'),
  },
  {
    find: /^@openframe\/shared$/,
    replacement: path.resolve(__dirname, '../../packages/shared/index.ts'),
  },
]

export default defineConfig(async () => {
  const plugins = [
    tanstackRouter({
      routesDirectory: '../ui/src/routes',
      generatedRouteTree: '../ui/src/routeTree.gen.ts',
    }),
    tailwindcss(),
    react(),
    ...(await electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          resolve: {
            alias: sharedAliases,
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          resolve: {
            alias: sharedAliases,
          },
        },
      },
      renderer: process.env.NODE_ENV === 'test' ? undefined : {},
    })),
  ]

  return {
    plugins,
    resolve: {
      alias: sharedAliases,
    },
  }
})
