export function parseArgs(args) {
  const flags = new Map()
  const positionals = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg.startsWith('--')) {
      const separator = arg.indexOf('=')
      if (separator !== -1) {
        flags.set(arg.slice(2, separator), arg.slice(separator + 1))
      } else if (args[index + 1] && !args[index + 1].startsWith('-')) {
        flags.set(arg.slice(2), args[++index])
      } else {
        flags.set(arg.slice(2), true)
      }
      continue
    }
    if (arg.startsWith('-') && arg.length > 1) {
      for (const key of arg.slice(1)) flags.set(key, true)
      continue
    }
    positionals.push(arg)
  }
  return { flags, positionals }
}
