#!/usr/bin/env node
import { main } from '../src/cli.js'

main(process.argv.slice(2)).catch((error) => {
  console.error(`ai-toolops failed: ${error.message}`)
  if (process.env.DEBUG) console.error(error)
  process.exit(1)
})
