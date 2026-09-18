const value = process.env.VITE_API_URL
try {
  const url = new URL(value || '')
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error()
} catch {
  throw new Error('Set VITE_API_URL to the public HTTPS API base URL, without credentials, query or fragment, before building the Static Site.')
}
