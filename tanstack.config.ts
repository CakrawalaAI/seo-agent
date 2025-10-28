const config = {
  target: 'react',
  routesDirectory: './src/app/routes',
  generatedRouteTree: './src/app/routeTree.gen.ts',
  extensions: ['tsx', 'ts'],
  watch: process.env.NODE_ENV === 'development',
  tmpDir: './.tanstack'
}

export default config
